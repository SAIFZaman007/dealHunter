/**
 * Chat History Routes
 * API routes for managing chat sessions and message history
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const auth = require('../middleware/auth');

// ===================================================
// CHAT SESSION MANAGEMENT
// ===================================================

/**
 * @route   GET /api/chat/sessions
 * @desc    Get all chat sessions for current user
 * @access  Protected
 */
router.get('/sessions', auth, chatController.getChatSessions);

/**
 * @route   GET /api/chat/sessions/search
 * @desc    Search chat sessions by title or summary
 * @access  Protected
 */
router.get('/sessions/search', auth, chatController.searchSessions);

/**
 * @route   GET /api/chat/sessions/:sessionId/messages
 * @desc    Get all messages in a specific chat session
 * @access  Protected
 */
router.get('/sessions/:sessionId/messages', auth, chatController.getSessionMessages);

/**
 * @route   POST /api/chat/sessions
 * @desc    Create new session or continue existing one
 * @access  Protected
 */
router.post('/sessions', auth, chatController.createOrContinueSession);

/**
 * @route   POST /api/chat/sessions/:sessionId/response
 * @desc    Save AI response to session
 * @access  Protected
 */
router.post('/sessions/:sessionId/response', auth, chatController.saveAIResponse);

/**
 * @route   PATCH /api/chat/sessions/:sessionId/title
 * @desc    Update session title
 * @access  Protected
 */
router.patch('/sessions/:sessionId/title', auth, chatController.updateSessionTitle);

/**
 * @route   PATCH /api/chat/sessions/:sessionId/pin
 * @desc    Pin or unpin a chat session
 * @access  Protected
 */
router.patch('/sessions/:sessionId/pin', auth, chatController.togglePinSession);

/**
 * @route   DELETE /api/chat/sessions/:sessionId
 * @desc    Delete a chat session
 * @access  Protected
 */
router.delete('/sessions/:sessionId', auth, chatController.deleteSession);

module.exports = router;