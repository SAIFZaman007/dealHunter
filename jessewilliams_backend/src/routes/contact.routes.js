const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// Public route
router.post('/', contactController.sendMessage);

// Admin routes
router.get('/', auth, isAdmin, contactController.getAllMessages);
router.put('/:id/read', auth, isAdmin, contactController.markAsRead);
router.delete('/:id', auth, isAdmin, contactController.deleteMessage);

module.exports = router;
