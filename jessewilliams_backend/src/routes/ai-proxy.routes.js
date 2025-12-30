const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

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
    console.log(`📝 Onboarding request from user: ${req.user.id}`);
    const { profile } = req.body;

    if (!profile) {
      return res.status(400).json({
        success: false,
        error: 'Profile data is required'
      });
    }

    // SAVE TO DATABASE (not just AI service)
    await prisma.userProfile.upsert({
      where: { userId: req.user.id },
      update: {
        propertyType: profile.propertyType,
        strategy: profile.strategy,
        rentalType: profile.rentalType,
        startingCapital: parseFloat(profile.startingCapital),
        targetGeography: profile.targetGeography,
        investmentTimeline: profile.investmentTimeline,
        profitGoal: parseFloat(profile.profitGoal)
      },
      create: {
        userId: req.user.id,
        propertyType: profile.propertyType,
        strategy: profile.strategy,
        rentalType: profile.rentalType,
        startingCapital: parseFloat(profile.startingCapital),
        targetGeography: profile.targetGeography,
        investmentTimeline: profile.investmentTimeline,
        profitGoal: parseFloat(profile.profitGoal)
      }
    });

    // Also send to AI service for immediate use
    const response = await axios.post(
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

    console.log('✅ Profile saved to database AND AI service');
    res.json({ success: true, message: 'Profile saved successfully' });
  } catch (error) {
    console.error('❌ Onboarding error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save profile'
    });
  }
});

/**
 * =====================================================
 * CHAT ENDPOINT - FETCH PROFILE FROM DATABASE
 * =====================================================
 */
router.post('/chat', auth, async (req, res) => {
  try {
    console.log(`💬 Chat request from user: ${req.user.id}`);
    const { message, sessionId, agentType } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId are required'
      });
    }

    // FETCH USER PROFILE FROM DATABASE
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

    // Send profile WITH the chat request
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
        timeout: 60000
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('❌ Chat error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Status endpoint for frontend polling
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
 * STREAMING CHAT ENDPOINT
 * =====================================================
 */
router.post('/chat/stream', auth, async (req, res) => {
  try {
    const { message, sessionId, agentType } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId are required'
      });
    }

    const response = await axios.post(
      `${AI_SERVICE_URL}/api/chat/stream`,
      {
        userId: req.user.id,
        sessionId,
        message,
        agentType: agentType || 'deal-hunter'
      },
      {
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    response.data.pipe(res);
  } catch (error) {
    console.error('❌ Stream error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Streaming failed'
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