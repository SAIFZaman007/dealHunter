const stripeService = require('../services/stripe.service');
const prisma = require('../config/database');

// @desc    Create Stripe Checkout Session
// @route   POST /api/payments/create-checkout-session
// @access  Private
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;

    // Validation
    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }

    // Create checkout session
    const session = await stripeService.createCheckoutSession({
      userId,
      planId,
      successUrl,
      cancelUrl
    });

    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully',
      data: session
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    
    if (error.message) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

// @desc    Stripe Webhook Handler
// @route   POST /api/payments/webhook
// @access  Public (but verified by Stripe signature)
exports.handleWebhook = async (req, res, next) => {
  const signature = req.headers['stripe-signature'];

  // Determine raw payload for Stripe signature verification
  let rawPayload;
  if (Buffer.isBuffer(req.body)) {
    rawPayload = req.body;
  } else if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    rawPayload = req.rawBody;
  } else if (typeof req.body === 'string') {
    rawPayload = Buffer.from(req.body);
  }

  if (!rawPayload) {
    console.error('Webhook error: missing raw request body for signature verification');
    return res.status(400).json({
      success: false,
      message: 'Missing raw request body. Ensure the webhook route is using express.raw() or that express.json() is configured with a verify hook to preserve the raw body.'
    });
  }

  try {
    // Verify and handle webhook using raw payload
    const result = await stripeService.handleWebhook(rawPayload, signature);

    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error.message || error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Webhook handling error'
    });
  }
};

// @desc    Verify Payment Session
// @route   GET /api/payments/verify-session/:sessionId
// @access  Private
exports.verifySession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Get session from Stripe
    const session = await stripeService.getCheckoutSession(sessionId);

    // Find order by session ID
    const order = await prisma.order.findFirst({
      where: {
        planDetails: {
          path: ['stripeSessionId'],
          equals: sessionId
        }
      },
      include: {
        payments: true
      }
    });

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.payment_status,
          customerEmail: session.customer_email,
          amountTotal: session.amount_total / 100
        },
        order: order || null
      }
    });
  } catch (error) {
    console.error('Verify session error:', error);
    
    if (error.message) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};

// @desc    Get Payment History
// @route   GET /api/payments/history
// @access  Private
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const payments = await prisma.payment.findMany({
      where: {
        order: {
          userId: userId
        }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            planDetails: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request Refund (Admin only)
// @route   POST /api/payments/refund
// @access  Private/Admin
exports.requestRefund = async (req, res, next) => {
  try {
    const { paymentId, amount } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    // Get payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'SUCCEEDED') {
      return res.status(400).json({
        success: false,
        message: 'Can only refund succeeded payments'
      });
    }

    if (!payment.stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe payment intent found'
      });
    }

    // Create refund in Stripe
    const refund = await stripeService.createRefund(
      payment.stripePaymentIntentId,
      amount
    );

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        metadata: {
          ...payment.metadata,
          refundId: refund.id,
          refundedAt: new Date().toISOString(),
          refundAmount: refund.amount / 100
        }
      }
    });

    // Update order status
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: 'REFUNDED' }
    });

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    
    if (error.message) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    next(error);
  }
};
