const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../config/database');

/**
 * Create Stripe Checkout Session for subscription purchase
 */
const createCheckoutSession = async ({ userId, planId, successUrl, cancelUrl }) => {
  try {
    // Get plan details
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        gptProduct: true
      }
    });

    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    if (!plan.isActive) {
      throw new Error('This plan is not currently available');
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate order number
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

    // Calculate amounts
    const subtotal = parseFloat(plan.price);
    const tax = 0; // Configure tax if needed
    const total = subtotal + tax;

    // Create order in pending state
    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber,
        subtotal,
        tax,
        total,
        status: 'PENDING',
        planDetails: {
          planId: plan.id,
          planName: plan.name,
          gptName: plan.gptProduct.name,
          gptProductId: plan.gptProductId,
          duration: plan.duration,
          price: plan.price.toString(),
          features: plan.features,
          maxRequests: plan.maxRequests
        }
      }
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: `${plan.gptProduct.name} - ${plan.duration}`,
              images: plan.gptProduct.icon ? [] : undefined, // Add image URLs if available
            },
            unit_amount: Math.round(total * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // Use 'subscription' for recurring payments
      success_url: successUrl || `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
      customer_email: user.email,
      client_reference_id: order.id, // Link to our order
      metadata: {
        orderId: order.id,
        userId: user.id,
        planId: plan.id,
        orderNumber: orderNumber
      }
    });

    // Update order with Stripe session ID
    await prisma.order.update({
      where: { id: order.id },
      data: {
        planDetails: {
          ...order.planDetails,
          stripeSessionId: session.id
        }
      }
    });

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total
      }
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Handle Stripe Webhook Events
 */
const handleWebhook = async (payload, signature) => {
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    throw new Error(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object);
      break;

    case 'charge.refunded':
      await handleChargeRefunded(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { received: true, eventType: event.type };
};

/**
 * Handle successful checkout session
 */
const handleCheckoutSessionCompleted = async (session) => {
  try {
    const orderId = session.metadata.orderId;
    const userId = session.metadata.userId;
    const planId = session.metadata.planId;

    console.log('Processing checkout.session.completed for order:', orderId);

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });

    if (!order) {
      console.error('Order not found:', orderId);
      return;
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        status: 'SUCCEEDED',
        paymentMethod: 'stripe',
        stripePaymentIntentId: session.payment_intent,
        metadata: {
          sessionId: session.id,
          customerEmail: session.customer_email
        }
      }
    });

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' }
    });

    // Create or update subscription
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (plan) {
      // Calculate subscription end date
      const startDate = new Date();
      const endDate = new Date(startDate);
      
      if (plan.duration === 'MONTHLY') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (plan.duration === 'ANNUAL') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Check if user already has an active subscription for this GPT product
      const existingSubscription = await prisma.userSubscription.findFirst({
        where: {
          userId: userId,
          planId: planId,
          status: 'ACTIVE'
        }
      });

      if (existingSubscription) {
        // Extend existing subscription
        await prisma.userSubscription.update({
          where: { id: existingSubscription.id },
          data: {
            endDate: endDate,
            status: 'ACTIVE'
          }
        });
      } else {
        // Create new subscription
        await prisma.userSubscription.create({
          data: {
            userId: userId,
            planId: planId,
            status: 'ACTIVE',
            startDate: startDate,
            endDate: endDate,
            stripeSubscriptionId: session.subscription || null,
            stripeCustomerId: session.customer || null
          }
        });
      }
    }

    console.log('Order completed successfully:', orderId);
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
    throw error;
  }
};

/**
 * Handle successful payment intent
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    console.log('Payment intent succeeded:', paymentIntent.id);

    // Update payment record if exists
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          stripeChargeId: paymentIntent.charges?.data[0]?.id,
          metadata: {
            ...payment.metadata,
            paymentIntentStatus: paymentIntent.status
          }
        }
      });
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
};

/**
 * Handle failed payment intent
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    console.log('Payment intent failed:', paymentIntent.id);

    // Update payment record if exists
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...payment.metadata,
            failureMessage: paymentIntent.last_payment_error?.message
          }
        }
      });

      // Update order status
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'FAILED' }
      });
    }
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
};

/**
 * Handle charge refunded
 */
const handleChargeRefunded = async (charge) => {
  try {
    console.log('Charge refunded:', charge.id);

    // Find payment by charge ID
    const payment = await prisma.payment.findFirst({
      where: { stripeChargeId: charge.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          metadata: {
            ...payment.metadata,
            refundedAt: new Date().toISOString(),
            refundAmount: charge.amount_refunded
          }
        }
      });

      // Update order status
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'REFUNDED' }
      });

      // Cancel associated subscription if exists
      const order = await prisma.order.findUnique({
        where: { id: payment.orderId }
      });

      if (order?.planDetails?.planId) {
        await prisma.userSubscription.updateMany({
          where: {
            userId: order.userId,
            planId: order.planDetails.planId,
            status: 'ACTIVE'
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        });
      }
    }
  } catch (error) {
    console.error('Error handling charge refunded:', error);
  }
};

/**
 * Retrieve checkout session details
 */
const getCheckoutSession = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    throw error;
  }
};

/**
 * Create a refund
 */
const createRefund = async (paymentIntentId, amount = null) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined // Full refund if amount not specified
    });

    return refund;
  } catch (error) {
    console.error('Error creating refund:', error);
    throw error;
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  getCheckoutSession,
  createRefund
};
