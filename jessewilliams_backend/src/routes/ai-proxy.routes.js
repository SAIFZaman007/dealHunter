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
    console.log(`📋 Onboarding request from user: ${req.user.id}`);
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
 * CHAT ENDPOINT WITH STREAMING - FETCH PROFILE FROM DATABASE
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

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

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

      // Get the full response
      const fullResponse = response.data.response;

      // Simulate streaming by sending chunks word by word
      const words = fullResponse.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
        
        // Send chunk as SSE
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        
        // Small delay to simulate natural typing (30ms per word)
        await new Promise(resolve => setTimeout(resolve, 30));
        
        // Flush the response to ensure chunk is sent immediately
        if (res.flush) res.flush();
      }

      // Send completion signal
      res.write('data: [DONE]\n\n');
      res.end();

    } catch (error) {
      console.error('❌ AI Service error:', error.response?.data || error.message);
      
      // Send error message as stream
      res.write(`data: ${JSON.stringify({ 
        error: 'Failed to process message',
        content: 'I apologize, but I encountered an error. Please try again.'
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }

  } catch (error) {
    console.error('❌ Chat error:', error.message);
    
    // Only send JSON error if headers not sent yet
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to process message'
      });
    } else {
      // If streaming already started, send error in stream format
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
 * STATUS ENDPOINT (for frontend polling if needed)
 * =====================================================
 */
router.get('/chat/status/:sessionId', auth, async (req, res) => {
  const { sessionId } = req.params;

  // Track status in memory (you can enhance this with Redis/DB)
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