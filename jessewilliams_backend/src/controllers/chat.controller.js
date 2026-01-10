/**
 * Chat History Controller
 * Manages chat sessions and message history
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get all chat sessions for current user
 * @route GET /api/chat/sessions
 */
const getChatSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, includeArchived = false } = req.query;

    const where = {
      userId,
      ...(includeArchived === 'false' && { isArchived: false })
    };

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { lastMessageAt: 'desc' }
        ],
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          title: true,
          agentType: true,
          isPinned: true,
          isArchived: true,
          summary: true,
          messageCount: true,
          lastMessageAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.chatSession.count({ where })
    ]);

    return res.status(200).json({
      success: true,
      sessions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + sessions.length)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching chat sessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chat sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get messages for a specific chat session
 * @route GET /api/chat/sessions/:sessionId/messages
 */
const getSessionMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Verify session belongs to user
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { messageIndex: 'asc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          role: true,
          content: true,
          messageIndex: true,
          hasFile: true,
          fileData: true,
          createdAt: true
        }
      }),
      prisma.chatMessage.count({ where: { sessionId } })
    ]);

    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        agentType: session.agentType,
        isPinned: session.isPinned
      },
      messages,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + messages.length)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching session messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create or continue a chat session
 * @route POST /api/chat/sessions
 */
const createOrContinueSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, message, agentType = 'deal-hunter' } = req.body;

    let session;
    let messageIndex = 0;

    if (sessionId) {
      // Continue existing session
      session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Chat session not found'
        });
      }

      messageIndex = session.messageCount;
    } else {
      // Create new session
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      
      session = await prisma.chatSession.create({
        data: {
          userId,
          title,
          agentType,
          messageCount: 0,
          lastMessageAt: new Date()
        }
      });
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
        messageIndex
      }
    });

    // Update session
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        title: session.title,
        messageIndex
      }
    });
  } catch (error) {
    console.error('❌ Error creating/continuing session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process chat session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Save AI response to session
 * @route POST /api/chat/sessions/:sessionId/response
 */
const saveAIResponse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { response, hasFile = false, fileData = null } = req.body;

    // Verify session belongs to user
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    const messageIndex = session.messageCount;

    // Save AI response
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: response,
        messageIndex,
        hasFile,
        fileData
      }
    });

    // Update session
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'AI response saved successfully'
    });
  } catch (error) {
    console.error('❌ Error saving AI response:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save AI response',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update session title
 * @route PATCH /api/chat/sessions/:sessionId/title
 */
const updateSessionTitle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      });
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: title.trim() }
    });

    return res.status(200).json({
      success: true,
      message: 'Session title updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating session title:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update session title',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Pin/Unpin session
 * @route PATCH /api/chat/sessions/:sessionId/pin
 */
const togglePinSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { isPinned: !session.isPinned }
    });

    return res.status(200).json({
      success: true,
      message: updated.isPinned ? 'Session pinned' : 'Session unpinned',
      isPinned: updated.isPinned
    });
  } catch (error) {
    console.error('❌ Error toggling pin:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle pin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete session
 * @route DELETE /api/chat/sessions/:sessionId
 */
const deleteSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    // Cascading delete will remove all messages
    await prisma.chatSession.delete({
      where: { id: sessionId }
    });

    console.log(`✅ Deleted chat session: ${sessionId}`);

    return res.status(200).json({
      success: true,
      message: 'Chat session deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Search chat sessions
 * @route GET /api/chat/sessions/search
 */
const searchSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const sessions = await prisma.chatSession.findMany({
      where: {
        userId,
        isArchived: false,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: { lastMessageAt: 'desc' },
      take: parseInt(limit),
      select: {
        id: true,
        title: true,
        agentType: true,
        isPinned: true,
        summary: true,
        messageCount: true,
        lastMessageAt: true,
        createdAt: true
      }
    });

    return res.status(200).json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('❌ Error searching sessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getChatSessions,
  getSessionMessages,
  createOrContinueSession,
  saveAIResponse,
  updateSessionTitle,
  togglePinSession,
  deleteSession,
  searchSessions
};