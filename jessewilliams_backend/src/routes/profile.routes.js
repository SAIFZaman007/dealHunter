const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Check if user has completed onboarding
router.get('/check', auth, async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    });

    res.json({
      hasProfile: !!profile,
      profile: profile || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check profile status' });
  }
});

module.exports = router;