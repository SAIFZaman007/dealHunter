const express = require('express');
const router = express.Router();
const gptController = require('../controllers/gpt.controller');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// Public routes
router.get('/', gptController.getAllGpts);
router.get('/:id', gptController.getGptById);

// Admin routes
router.post('/', auth, isAdmin, gptController.createGpt);
router.put('/:id', auth, isAdmin, gptController.updateGpt);
router.delete('/:id', auth, isAdmin, gptController.deleteGpt);

module.exports = router;
