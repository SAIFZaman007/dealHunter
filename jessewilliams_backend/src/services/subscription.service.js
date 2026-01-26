// Subscription Service
// Handles credit tracking and validation

const prisma = require('../config/database');
const { tokensToCredits, creditsToTokens } = require('../utils/tokenCounter');

// Get active subscription with remaining credits
const getActiveSubscription = async (userId) => {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } }
      ]
    },
    include: {
      plan: {
        select: {
          name: true,
          maxRequests: true,
          duration: true
        }
      }
    }
  });

  if (!subscription) {
    return null;
  }

  // Calculate remaining credits
  const maxTokens = subscription.plan.maxRequests || 25000; // Free: 25k tokens (2.5 credits)
  const usedTokens = subscription.requestsUsed || 0;
  const remainingTokens = Math.max(0, maxTokens - usedTokens);

  return {
    ...subscription,
    maxTokens,
    usedTokens,
    remainingTokens,
    maxCredits: tokensToCredits(maxTokens),
    usedCredits: tokensToCredits(usedTokens),
    remainingCredits: tokensToCredits(remainingTokens),
    percentageUsed: maxTokens > 0 ? (usedTokens / maxTokens) * 100 : 0
  };
};

// Check if user can make request
const canMakeRequest = async (userId, estimatedTokens = 1000) => {
  const subscription = await getActiveSubscription(userId);

  if (!subscription) {
    return {
      allowed: false,
      reason: 'NO_SUBSCRIPTION',
      message: 'No active subscription found. Please subscribe to continue.'
    };
  }

  if (subscription.remainingTokens < estimatedTokens) {
    return {
      allowed: false,
      reason: 'INSUFFICIENT_CREDITS',
      message: `Insufficient credits. You need ${tokensToCredits(estimatedTokens).toFixed(2)} credits but have ${subscription.remainingCredits.toFixed(2)} remaining.`,
      subscription
    };
  }

  return {
    allowed: true,
    subscription
  };
};

// Deduct tokens from subscription
const deductTokens = async (userId, tokensUsed) => {
  const subscription = await getActiveSubscription(userId);

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  const updated = await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      requestsUsed: {
        increment: tokensUsed
      }
    }
  });

  console.log(`✅ Deducted ${tokensUsed} tokens (${tokensToCredits(tokensUsed).toFixed(3)} credits) from user ${userId}`);

  return updated;
};


 // Reset monthly usage (called by cron job)
const resetMonthlyUsage = async () => {
  const monthlySubscriptions = await prisma.userSubscription.findMany({
    where: {
      plan: {
        duration: 'MONTHLY'
      },
      status: 'ACTIVE',
      lastResetDate: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      }
    }
  });

  for (const subscription of monthlySubscriptions) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        requestsUsed: 0,
        lastResetDate: new Date()
      }
    });
  }

  console.log(`🔄 Reset usage for ${monthlySubscriptions.length} monthly subscriptions`);
  return monthlySubscriptions.length;
};

 // Get usage statistics
const getUsageStats = async (userId) => {
  const subscription = await getActiveSubscription(userId);

  if (!subscription) {
    return null;
  }

  // Get chat history for the period
  const chatCount = await prisma.chatSession.count({
    where: {
      userId,
      createdAt: {
        gte: subscription.startDate
      }
    }
  });

  return {
    subscription: {
      plan: subscription.plan.name,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate
    },
    usage: {
      maxCredits: subscription.maxCredits,
      usedCredits: subscription.usedCredits,
      remainingCredits: subscription.remainingCredits,
      percentageUsed: subscription.percentageUsed,
      maxTokens: subscription.maxTokens,
      usedTokens: subscription.usedTokens,
      remainingTokens: subscription.remainingTokens
    },
    activity: {
      totalChats: chatCount,
      lastResetDate: subscription.lastResetDate
    }
  };
};

module.exports = {
  getActiveSubscription,
  canMakeRequest,
  deductTokens,
  resetMonthlyUsage,
  getUsageStats
};