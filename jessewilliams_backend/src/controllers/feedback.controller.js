/**
 * Feedback Controller - Backend API
 * Handles saving and retrieving chat feedback ratings
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Save chat feedback (thumbs up/down)
 */
const saveFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const {
      sessionId,
      messageIndex,
      userMessage,
      aiResponse,
      rating,
      agentType,
      comment
    } = req.body;

    // Validation
    if (!sessionId || messageIndex === undefined || !userMessage || !aiResponse || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId, messageIndex, userMessage, aiResponse, rating'
      });
    }

    if (!['GOOD', 'BAD'].includes(rating)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating. Must be GOOD or BAD'
      });
    }

    // Check if feedback already exists
    const existingFeedback = await prisma.chatFeedback.findFirst({
      where: {
        userId,
        sessionId,
        messageIndex
      }
    });

    let feedback;

    if (existingFeedback) {
      feedback = await prisma.chatFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          rating,
          comment: comment || null,
          updatedAt: new Date()
        }
      });
      console.log(`✅ Updated feedback: ${feedback.id} - Rating: ${rating}`);
    } else {
      feedback = await prisma.chatFeedback.create({
        data: {
          userId,
          sessionId,
          messageIndex,
          userMessage,
          aiResponse,
          rating,
          agentType: agentType || 'deal-hunter',
          comment: comment || null
        }
      });
      console.log(`✅ Created feedback: ${feedback.id} - Rating: ${rating}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Feedback saved successfully',
      feedback: {
        id: feedback.id,
        rating: feedback.rating,
        createdAt: feedback.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error saving feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get feedback statistics (admin)
 */
const getFeedbackStats = async (req, res) => {
  try {
    const { startDate, endDate, agentType } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (agentType) where.agentType = agentType;

    const [goodCount, badCount, totalCount] = await Promise.all([
      prisma.chatFeedback.count({ where: { ...where, rating: 'GOOD' } }),
      prisma.chatFeedback.count({ where: { ...where, rating: 'BAD' } }),
      prisma.chatFeedback.count({ where })
    ]);

    const goodPercentage = totalCount > 0 ? (goodCount / totalCount * 100).toFixed(2) : 0;
    const badPercentage = totalCount > 0 ? (badCount / totalCount * 100).toFixed(2) : 0;

    const recentBadFeedback = await prisma.chatFeedback.findMany({
      where: { ...where, rating: 'BAD' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        userMessage: true,
        aiResponse: true,
        createdAt: true,
        comment: true,
        user: {
          select: {
            email: true,
            fullName: true
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        total: totalCount,
        good: goodCount,
        bad: badCount,
        goodPercentage: parseFloat(goodPercentage),
        badPercentage: parseFloat(badPercentage)
      },
      recentBadFeedback
    });

  } catch (error) {
    console.error('❌ Error fetching feedback stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's feedback history
 */
const getUserFeedbackHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const feedback = await prisma.chatFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        sessionId: true,
        messageIndex: true,
        userMessage: true,
        rating: true,
        createdAt: true,
        agentType: true
      }
    });

    const total = await prisma.chatFeedback.count({ where: { userId } });

    return res.status(200).json({
      success: true,
      feedback,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + feedback.length)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user feedback history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete feedback
 */
const deleteFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { feedbackId } = req.params;

    const feedback = await prisma.chatFeedback.findFirst({
      where: {
        id: feedbackId,
        userId
      }
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found or does not belong to you'
      });
    }

    await prisma.chatFeedback.delete({
      where: { id: feedbackId }
    });

    console.log(`✅ Deleted feedback: ${feedbackId}`);

    return res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


module.exports = {
  saveFeedback,
  getFeedbackStats,
  getUserFeedbackHistory,
  deleteFeedback
};