const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// All routes require admin access
router.use(auth, isAdmin);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/orders', adminController.getAllOrders);
router.get('/subscriptions', adminController.getAllSubscriptions);

module.exports = router; 
