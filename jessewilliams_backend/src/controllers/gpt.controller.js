const prisma = require('../config/database');

// @desc    Get all GPT products
// @route   GET /api/gpts
// @access  Public
exports.getAllGpts = async (req, res, next) => {
  try {
    const gpts = await prisma.gptProduct.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        subscriptionPlans: {
          where: { isActive: true },
          orderBy: { price: 'asc' }
        }
      }
    });

    res.json({
      success: true,
      count: gpts.length,
      data: gpts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single GPT product
// @route   GET /api/gpts/:id
// @access  Public
exports.getGptById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const gpt = await prisma.gptProduct.findUnique({
      where: { id },
      include: {
        subscriptionPlans: {
          where: { isActive: true },
          orderBy: { price: 'asc' }
        }
      }
    });

    if (!gpt) {
      return res.status(404).json({ 
        success: false, 
        message: 'GPT product not found' 
      });
    }

    res.json({
      success: true,
      data: gpt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create GPT product
// @route   POST /api/gpts
// @access  Private/Admin
exports.createGpt = async (req, res, next) => {
  try {
    const { name, slug, description, features, icon, gptModel, systemPrompt, isFeatured, order } = req.body;

    const gpt = await prisma.gptProduct.create({
      data: {
        name,
        slug,
        description,
        features,
        icon,
        gptModel,
        systemPrompt,
        isFeatured,
        order
      }
    });

    res.status(201).json({
      success: true,
      message: 'GPT product created successfully',
      data: gpt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update GPT product
// @route   PUT /api/gpts/:id
// @access  Private/Admin
exports.updateGpt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const gpt = await prisma.gptProduct.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'GPT product updated successfully',
      data: gpt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete GPT product
// @route   DELETE /api/gpts/:id
// @access  Private/Admin
exports.deleteGpt = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.gptProduct.delete({ where: { id } });

    res.json({
      success: true,
      message: 'GPT product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
