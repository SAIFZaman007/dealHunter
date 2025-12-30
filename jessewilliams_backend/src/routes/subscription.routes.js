const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// Public routes
router.get('/plans', subscriptionController.getAllPlans);
router.get('/plans/:id', subscriptionController.getPlanById);

// Protected routes
router.post('/subscribe', auth, subscriptionController.subscribe);
router.get('/my-subscription', auth, subscriptionController.getMySubscription);
router.get('/my-subscriptions', auth, subscriptionController.getMySubscriptions);
router.post('/cancel', auth, subscriptionController.cancelSubscription);
router.get('/usage', auth, subscriptionController.getUsage);

// Admin routes
router.post('/plans', auth, isAdmin, subscriptionController.createPlan);
router.put('/plans/:id', auth, isAdmin, subscriptionController.updatePlan);
router.delete('/plans/:id', auth, isAdmin, subscriptionController.deletePlan);

module.exports = router;
