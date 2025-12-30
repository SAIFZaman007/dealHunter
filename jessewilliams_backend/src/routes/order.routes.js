const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const auth = require('../middleware/auth');

// Protected routes
router.post('/create', auth, orderController.createOrder);
router.get('/', auth, orderController.getMyOrders);
router.get('/:id', auth, orderController.getOrderById);

module.exports = router;
