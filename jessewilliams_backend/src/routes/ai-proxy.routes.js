const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { checkSubscriptionDynamic } = require('../middleware/checkSubscription');
const { deductTokens } = require('../services/subscription.service');
const { calculateChatTokens, tokensToCredits } = require('../utils/tokenCounter');


const router = express.Router();
const prisma = new PrismaClient();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

/**
 * =====================================================
 * ONBOARDING ENDPOINT - SAVE PROFILE TO DATABASE
 * =====================================================
 */
router.post('/onboarding', auth, async (req, res) => {
  try {
    console.log(`📋 Onboarding request from user: ${req.user.id}`);
    const { profile } = req.body;

    if (!profile) {
      return res.status(400).json({
        success: false,
        error: 'Profile data is required'
      });
    }

    // Validate required fields
    const requiredFields = ['propertyType', 'strategy', 'startingCapital', 'targetGeography', 'investmentTimeline', 'profitGoal'];
    const missingFields = requiredFields.filter(field => !profile[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // SAVE TO DATABASE - Use findUnique then update or create
    let userProfile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (userProfile) {
      // Update existing profile
      userProfile = await prisma.userProfile.update({
        where: { userId: req.user.id },
        data: {
          propertyType: profile.propertyType,
          strategy: profile.strategy,
          rentalType: profile.rentalType || null,
          startingCapital: parseFloat(profile.startingCapital),
          targetGeography: profile.targetGeography,
          investmentTimeline: profile.investmentTimeline,
          profitGoal: parseFloat(profile.profitGoal)
        }
      });
    } else {
      // Create new profile
      userProfile = await prisma.userProfile.create({
        data: {
          userId: req.user.id,
          propertyType: profile.propertyType,
          strategy: profile.strategy,
          rentalType: profile.rentalType || null,
          startingCapital: parseFloat(profile.startingCapital),
          targetGeography: profile.targetGeography,
          investmentTimeline: profile.investmentTimeline,
          profitGoal: parseFloat(profile.profitGoal)
        }
      });
    }

    console.log('✅ Profile saved to database successfully');
    
    // Only send to AI service if it's configured
    if (AI_SERVICE_URL) {
      try {
        await axios.post(
          `${AI_SERVICE_URL}/api/onboarding`,
          { userId: req.user.id, profile },
          {
            headers: {
              'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        console.log('✅ Profile also sent to AI service');
      } catch (aiError) {
        console.warn('⚠️ AI service sync failed (non-critical):', aiError.message);
        // Don't fail the whole request if AI service is down
      }
    }

    res.json({ success: true, message: 'Profile saved successfully' });
  } catch (error) {
    console.error('❌ Onboarding error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save profile'
    });
  }
});

/**
 * =====================================================
 * CHAT ENDPOINT WITH STREAMING AND FILE GENERATION
 * =====================================================
 */
router.post('/chat', auth, checkSubscriptionDynamic, async (req, res) => {
  try {
    console.log(`💬 Chat request from user: ${req.user.id}`);
    const { message, sessionId, agentType } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId are required'
      });
    }

    // FETCH USER PROFILE
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!userProfile) {
      return res.status(400).json({
        success: false,
        error: 'Please complete onboarding first',
        needsOnboarding: true
      });
    }

    try {
      // Make request to AI service
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/chat`,
        {
          userId: req.user.id,
          sessionId,
          message,
          agentType: agentType || 'deal-hunter',
          userProfile: {
            propertyType: userProfile.propertyType,
            strategy: userProfile.strategy,
            rentalType: userProfile.rentalType,
            startingCapital: userProfile.startingCapital.toString(),
            targetGeography: userProfile.targetGeography,
            investmentTimeline: userProfile.investmentTimeline,
            profitGoal: userProfile.profitGoal.toString()
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
            'Content-Type': 'application/json'
          },
          timeout: 90000
        }
      );

      const aiResponse = response.data.response;

      // ============================================
      // CALCULATE & DEDUCT TOKENS
      // ============================================
      const tokenUsage = calculateChatTokens(message, aiResponse);
      
      try {
        await deductTokens(req.user.id, tokenUsage.totalTokens);
        console.log(`💳 Deducted ${tokensToCredits(tokenUsage.totalTokens).toFixed(3)} credits`);
      } catch (deductError) {
        console.error('❌ Token deduction error:', deductError);
        // Continue anyway - don't fail the request
      }

      // ============================================
      // CHECK IF FILE WAS GENERATED
      // ============================================
      if (response.data.fileGenerated && response.data.file) {
        console.log('📄 File generated, returning JSON response');
        
        return res.json({
          success: true,
          response: aiResponse,
          sessionId,
          fileGenerated: true,
          file: {
            name: response.data.file.name,
            data: response.data.file.data,
            mimeType: response.data.file.mimeType
          },
          tokenUsage: {
            used: tokenUsage.totalTokens,
            credits: tokensToCredits(tokenUsage.totalTokens).toFixed(3)
          }
        });
      }

      // ============================================
      // STREAM TEXT RESPONSE
      // ============================================
      console.log('💬 Streaming text response');
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const words = aiResponse.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 30));
        if (res.flush) res.flush();
      }

      // Send token usage with completion
      res.write(`data: ${JSON.stringify({ 
        tokenUsage: {
          used: tokenUsage.totalTokens,
          credits: tokensToCredits(tokenUsage.totalTokens).toFixed(3)
        }
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();

    } catch (error) {
      console.error('❌ AI Service error:', error.response?.data || error.message);
      
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to process message'
        });
      }
      
      res.write(`data: ${JSON.stringify({ 
        error: 'Failed to process message',
        content: 'I apologize, but I encountered an error. Please try again after upgrading your plan.'
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }

  } catch (error) {
    console.error('❌ Chat error:', error.message);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to process message'
      });
    } else {
      res.write(`data: ${JSON.stringify({ 
        error: 'Server error',
        content: 'An unexpected error occurred.'
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

/**
 * =====================================================
 * GET USAGE STATISTICS
 * =====================================================
 */
router.get('/usage', auth, async (req, res) => {
  try {
    const { getUsageStats } = require('../services/subscription.service');
    const stats = await getUsageStats(req.user.id);

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Usage stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics'
    });
  }
});


/**
 * =====================================================
 * STATUS ENDPOINT (for frontend polling if needed)
 * =====================================================
 */
router.get('/chat/status/:sessionId', auth, async (req, res) => {
  const { sessionId } = req.params;

  // Track status in memory
  res.json({
    status: 'processing',
    message: 'Searching the web and analyzing market data...'
  });
});

/**
 * =====================================================
 * STARTUP CONFIG VALIDATION (DEBUGGING)
 * =====================================================
 */
if (!INTERNAL_API_SECRET) {
  console.error('❌ INTERNAL_API_SECRET not set in environment');
} else {
  console.log(`✅ AI Proxy connected to ${AI_SERVICE_URL}`);
}

/**
 * =====================================================
 * HEALTH / DEBUG ENDPOINT (NO AUTH)
 * =====================================================
 */
router.get('/test', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`);
    res.json({
      success: true,
      message: 'AI service reachable',
      aiService: response.data,
      config: {
        aiServiceUrl: AI_SERVICE_URL,
        hasInternalSecret: !!INTERNAL_API_SECRET
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Unable to reach AI service',
      details: error.message
    });
  }
});

/**
 * =====================================================
 * CHAT HISTORY ENDPOINT
 * =====================================================
 */
router.get('/history/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.get(
      `${AI_SERVICE_URL}/api/history/${req.user.id}/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_SECRET}`
        },
        timeout: 10000
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('❌ History error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history'
    });
  }
});

module.exports = router;