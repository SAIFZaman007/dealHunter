const prisma = require('../config/database');

// @desc    Create order
// @route   POST /api/orders/create
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    // Get plan details
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
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

    // Generate order number
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

    // Calculate amounts
    const subtotal = plan.price;
    const tax = subtotal * 0; // Set tax rate as needed
    const total = subtotal + tax;

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber,
        subtotal,
        tax,
        total,
        planDetails: {
          planId: plan.id,
          planName: plan.name,
          gptName: plan.gptProduct.name,
          duration: plan.duration,
          price: plan.price
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        payments: true
      }
    });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId: req.user.id
      },
      include: {
        payments: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};
