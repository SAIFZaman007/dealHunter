const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// Webhook route (NO AUTH - verified by Stripe signature)
// This route MUST use raw body, configured in server.js
router.post('/webhook', paymentController.handleWebhook);

// Protected routes
router.post('/create-checkout-session', auth, paymentController.createCheckoutSession);
router.get('/verify-session/:sessionId', auth, paymentController.verifySession);
router.get('/history', auth, paymentController.getPaymentHistory);

// Admin routes
router.post('/refund', auth, isAdmin, paymentController.requestRefund);

module.exports = router;
