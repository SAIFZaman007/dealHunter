/**
 * Feedback Routes
 * API routes for chat feedback functionality
 */

const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const auth = require('../middleware/auth');  

// ===================================================
// ADMIN MIDDLEWARE
// ===================================================
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// ===================================================
// PUBLIC/USER ROUTES (Require Authentication)
// ===================================================

/**
 * @route   POST /api/ai/feedback
 * @desc    Save chat feedback (thumbs up/down)
 * @access  Protected
 */
router.post('/feedback', auth, feedbackController.saveFeedback);

/**
 * @route   GET /api/ai/feedback/my-history
 * @desc    Get user's feedback history
 * @access  Protected
 */
router.get('/feedback/my-history', auth, feedbackController.getUserFeedbackHistory);

/**
 * @route   DELETE /api/ai/feedback/:feedbackId
 * @desc    Delete a feedback entry
 * @access  Protected
 */
router.delete('/feedback/:feedbackId', auth, feedbackController.deleteFeedback);

// ===================================================
// ADMIN ROUTES (Require Admin Role)
// ===================================================

/**
 * @route   GET /api/ai/feedback/stats
 * @desc    Get feedback statistics for dashboard
 * @access  Admin Only
 */
router.get('/feedback/stats', auth, isAdmin, feedbackController.getFeedbackStats);

module.exports = router;