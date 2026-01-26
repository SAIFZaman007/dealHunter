const prisma = require('../config/database');

// @desc    Get all subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
exports.getAllPlans = async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        gptProduct: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true
          }
        }
      },
      orderBy: { price: 'asc' }
    });

    res.json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single plan
// @route   GET /api/subscriptions/plans/:id
// @access  Public
exports.getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        gptProduct: true
      }
    });

    if (!plan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Plan not found' 
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Subscribe to a plan
// @route   POST /api/subscriptions/subscribe
// @access  Private
exports.subscribe = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    // Check if plan exists
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Plan not found' 
      });
    }

    // PREVENT MANUAL FREE PLAN SUBSCRIPTION
    // Users are auto-subscribed to Free plan on registration
    if (plan.price === 0) {
      return res.status(400).json({
        success: false,
        message: 'Free plan is automatically assigned. You already have it!',
        hint: 'To upgrade, choose Starter or Pro plan.'
      });
    }

    // Check for existing active subscription
    const existingSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      },
      include: {
        plan: {
          select: {
            name: true,
            price: true
          }
        }
      }
    });

    if (existingSubscription) {
      // Allow upgrading from Free to Paid
      if (existingSubscription.plan.price === 0 && plan.price > 0) {
        console.log(`📈 User ${userId} upgrading from Free to ${plan.name}`);
        // Cancel Free plan subscription
        await prisma.userSubscription.update({
          where: { id: existingSubscription.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        });
      } else {
        // Already has a paid plan
        return res.status(400).json({ 
          success: false, 
          message: `You already have an active ${existingSubscription.plan.name} subscription. Please cancel it first or contact support to upgrade.`
        });
      }
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date();
    if (plan.duration === 'MONTHLY') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Create subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        startDate,
        endDate,
        requestsUsed: 0 // Reset usage on new subscription
      },
      include: {
        plan: {
          include: {
            gptProduct: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully subscribed to ${plan.name} plan`,
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's subscription
// @route   GET /api/subscriptions/my-subscription
// @access  Private
exports.getMySubscription = async (req, res, next) => {
  try {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE'
      },
      include: {
        plan: {
          include: {
            gptProduct: true
          }
        }
      }
    });

    // SAFETY NET: If no subscription found, auto-create Free plan
    if (!subscription) {
      console.log('⚠️  No active subscription found, auto-subscribing to Free plan...');
      
      const { autoSubscribeFreePlan } = require('../services/auth.service');
      const newSubscription = await autoSubscribeFreePlan(req.user.id);

      if (newSubscription) {
        // Fetch the complete subscription data
        const completeSubscription = await prisma.userSubscription.findUnique({
          where: { id: newSubscription.id },
          include: {
            plan: {
              include: {
                gptProduct: true
              }
            }
          }
        });

        return res.json({
          success: true,
          data: completeSubscription,
          autoCreated: true
        });
      }
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's subscriptions list
// @route   GET /api/subscriptions/my-subscriptions
// @access  Private
exports.getMySubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await prisma.userSubscription.findMany({
      where: { userId: req.user.id },
      include: {
        plan: {
          include: {
            gptProduct: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel subscription
// @route   POST /api/subscriptions/cancel
// @access  Private
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE'
      },
      include: {
        plan: {
          select: {
            name: true,
            price: true
          }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active subscription found' 
      });
    }

    // 🎯 PREVENT CANCELLING FREE PLAN
    if (subscription.plan.price === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel Free plan. This is your default plan.',
        hint: 'Free plan stays active until you upgrade.'
      });
    }

    // Cancel paid subscription
    const updatedSubscription = await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    // 🎯 AUTO-REVERT TO FREE PLAN
    const { autoSubscribeFreePlan } = require('../services/auth.service');
    await autoSubscribeFreePlan(req.user.id);

    res.json({
      success: true,
      message: `${subscription.plan.name} subscription cancelled. You've been reverted to the Free plan.`,
      data: updatedSubscription
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get usage statistics
// @route   GET /api/subscriptions/usage
// @access  Private
exports.getUsage = async (req, res, next) => {
  try {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE'
      },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active subscription found' 
      });
    }

    const usage = {
      requestsUsed: subscription.requestsUsed,
      requestsLimit: subscription.plan.maxRequests,
      percentage: subscription.plan.maxRequests 
        ? (subscription.requestsUsed / subscription.plan.maxRequests) * 100 
        : 0,
      lastResetDate: subscription.lastResetDate
    };

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create subscription plan
// @route   POST /api/subscriptions/plans
// @access  Private/Admin
exports.createPlan = async (req, res, next) => {
  try {
    const { name, description, price, duration, features, maxRequests, gptProductId, stripePriceId } = req.body;

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        description,
        price,
        duration,
        features,
        maxRequests,
        gptProductId,
        stripePriceId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update subscription plan
// @route   PUT /api/subscriptions/plans/:id
// @access  Private/Admin
exports.updatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: plan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete subscription plan
// @route   DELETE /api/subscriptions/plans/:id
// @access  Private/Admin
exports.deletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.subscriptionPlan.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};