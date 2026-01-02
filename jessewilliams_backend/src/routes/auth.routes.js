const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');  // For profile check

const prisma = new PrismaClient();  // Initialize Prisma client

// ============================================
// PUBLIC ROUTES
// ============================================
router.post('/register', authController.register);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.post('/login', authController.login);

// ============================================
// PROTECTED ROUTES
// ============================================
router.get('/me', auth, authController.getMe);
router.put('/update-profile', auth, authController.updateProfile);
router.put('/change-password', auth, authController.changePassword);

// ✅ NEW: Profile check endpoint
router.get('/profile/check', auth, async (req, res) => {
  try {
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    });

    res.json({
      success: true,
      hasProfile: !!userProfile
    });
  } catch (error) {
    console.error('Profile check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check profile status'
    });
  }
});

module.exports = router;