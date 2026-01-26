/**
 * Subscription Check Middleware
 * Validates user has active subscription and sufficient credits
 */

const { canMakeRequest } = require('../services/subscription.service');
const { estimateTokens } = require('../utils/tokenCounter');

/**
 * Check if user has active subscription and credits
 * @param {number} estimatedTokens - Estimated tokens for the request (default: 1000)
 */
const checkSubscription = (estimatedTokens = 1000) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user can make request
      const check = await canMakeRequest(userId, estimatedTokens);

      if (!check.allowed) {
        return res.status(429).json({
          success: false,
          message: check.message,
          reason: check.reason,
          usage: check.subscription ? {
            remainingCredits: check.subscription.remainingCredits.toFixed(2),
            usedCredits: check.subscription.usedCredits.toFixed(2),
            maxCredits: check.subscription.maxCredits.toFixed(2),
            percentageUsed: check.subscription.percentageUsed.toFixed(1)
          } : null,
          upgradeUrl: '/settings/subscription'
        });
      }

      // Attach subscription info to request
      req.subscription = check.subscription;
      next();
    } catch (error) {
      console.error('❌ Subscription check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify subscription',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Dynamic token estimation based on message length
 */
const checkSubscriptionDynamic = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Estimate tokens from message (conservative: 2x for response)
    const estimatedTokens = message 
      ? estimateTokens(message) * 2.5 // User message + AI response + overhead
      : 1000; // Default fallback

    const check = await canMakeRequest(userId, estimatedTokens);

    if (!check.allowed) {
      return res.status(429).json({
        success: false,
        message: check.message,
        reason: check.reason,
        usage: check.subscription ? {
          remainingCredits: check.subscription.remainingCredits.toFixed(2),
          usedCredits: check.subscription.usedCredits.toFixed(2),
          maxCredits: check.subscription.maxCredits.toFixed(2),
          percentageUsed: check.subscription.percentageUsed.toFixed(1)
        } : null,
        upgradeUrl: '/settings/subscription'
      });
    }

    req.subscription = check.subscription;
    req.estimatedTokens = estimatedTokens;
    next();
  } catch (error) {
    console.error('❌ Dynamic subscription check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify subscription'
    });
  }
};

module.exports = {
  checkSubscription,
  checkSubscriptionDynamic
};