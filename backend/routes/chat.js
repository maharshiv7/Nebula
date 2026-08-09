const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { chatLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config for temporary file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Middleware to protect routes
const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Create a new chat or send message to existing chat (Streaming version with optional file upload)
router.post('/', auth, chatLimiter, upload.single('file'), async (req, res) => {
  try {
    const { message, chatId, tier } = req.body;
    let currentChatId = chatId;

    if (!message) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'Message content is required' });
    }

    // 0. Check User Plan, Model Tier Permission, Token Budget & Daily Calendar Reset
    const user = await User.findById(req.user.id);
    if (!user) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'User not found' });
    }

    const requestedTier = (tier || (user.plan === 'free' ? 'lite' : 'standard')).toLowerCase();

    // 0a. Model Tier Access Enforcement for Free Plan
    if (user.plan === 'free' && (requestedTier === 'standard' || requestedTier === 'pro')) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        message: 'Standard and Pro models require a subscription. Upgrade to unlock them.'
      });
    }

    // 0b. Daily Calendar Reset
    const now = new Date();
    if (new Date(user.usageResetAt).toDateString() !== now.toDateString()) {
      user.dailyTokensUsed = 0;
      user.dailyUploadsCount = 0;
      user.usageResetAt = now;
      await user.save();
    }

    // 0c. Daily File Upload Count Limit Check (Free: 10, Pro: 50)
    if (req.file) {
      const limit = user.plan === 'pro' ? 50 : 10;
      if ((user.dailyUploadsCount || 0) >= limit) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(403).json({
          message: `Daily upload limit reached (${user.dailyUploadsCount || 0} / ${limit}). Resets at midnight.`
        });
      }
    }

    // 0d. Daily Token/Credit Budget Check (Free: 1000 credits, Pro: 5000 tokens)
    const maxBudget = user.plan === 'pro' ? 5000 : 1000;
    if (user.dailyTokensUsed >= maxBudget) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ 
        message: `Daily limit reached (${user.dailyTokensUsed.toLocaleString()} / ${maxBudget.toLocaleString()} ${user.plan === 'pro' ? 'tokens' : 'credits'} used). Limit resets at midnight.` 
      });
    }

    // 1. Create a new chat if none exists
    if (!currentChatId) {
      const newChat = new Chat({
        user: req.user.id,
        title: message.substring(0, 30) + '...'
      });
      await newChat.save();
      currentChatId = newChat._id;
    } else {
      const chat = await Chat.findOne({ _id: currentChatId, user: req.user.id });
      if (!chat) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: 'Chat not found' });
      }
    }

    // 2. Save user message to DB (or reuse if updated by edit PUT endpoint)
    const userMessageContent = req.file ? `[Attached: ${req.file.originalname}]\n${message}` : message;
    const lastMessage = await Message.findOne({ chatId: currentChatId }).sort({ createdAt: -1 });
    let userMessage;

    if (lastMessage && lastMessage.role === 'user' && (lastMessage.content === userMessageContent || lastMessage.content === message)) {
      userMessage = lastMessage;
    } else {
      userMessage = new Message({
        chatId: currentChatId,
        role: 'user',
        content: userMessageContent
      });
      await userMessage.save();
    }

    // 3. Set up SSE headers for the client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Ensure headers are sent immediately

    // 4. Send metadata first so the frontend knows the chatId and user message
    const metadataEvent = {
      type: 'metadata',
      chatId: currentChatId,
      userMessage: userMessage
    };
    res.write(`data: ${JSON.stringify(metadataEvent)}\n\n`);

    // Helper function to safely delete temporary upload
    const cleanupTempFile = () => {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error cleaning up temp upload file:', err);
        });
      }
    };

    // 5. Forward request to FastAPI ML service
    let assistantResponseText = '';
    let assistantSources = [];
    let assistantModelUsed = 'openai/gpt-oss-120b';
    let assistantVerification = null;
    let extractedFileText = null;
    let actualTokensUsed = 0;
    
    try {
      let mlResponse;

      // Query prior message history for currentChatId (excluding current userMessage to avoid duplication)
      const priorMessages = await Message.find({
        chatId: currentChatId,
        _id: { $ne: userMessage._id }
      }).sort({ createdAt: 1 });

      const historyMessages = priorMessages.slice(-15).map(m => ({
        role: m.role,
        content: m.content
      }));

      if (req.file && fs.existsSync(req.file.path)) {
        const form = new FormData();
        form.append('message', message);
        form.append('user_id', req.user.id);
        form.append('tier', requestedTier);
        form.append('history', JSON.stringify(historyMessages));
        form.append('file', fs.createReadStream(req.file.path), {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });

        mlResponse = await axios.post(`${ML_SERVICE_URL}/chat`, form, {
          headers: form.getHeaders(),
          responseType: 'stream'
        });
      } else {
        mlResponse = await axios.post(`${ML_SERVICE_URL}/chat`, {
          message: message,
          user_id: req.user.id,
          tier: requestedTier,
          history: historyMessages
        }, {
          responseType: 'stream'
        });
      }

      // 6. Proxy the stream and accumulate tokens properly
      let buffer = '';
      mlResponse.data.on('data', (chunk) => {
        const textChunk = chunk.toString();
        res.write(textChunk);

        buffer += textChunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6);
              const data = JSON.parse(jsonStr);
              if (data.type === 'token') {
                assistantResponseText += data.content;
              } else if (data.type === 'sources') {
                assistantSources = data.content;
              } else if (data.type === 'model_info') {
                assistantModelUsed = data.content;
              } else if (data.type === 'verification') {
                assistantVerification = data.content;
              } else if (data.type === 'extracted_file_text') {
                extractedFileText = data.content;
              } else if (data.type === 'token_usage') {
                actualTokensUsed = data.content;
              }
            } catch (e) {
              // Ignore partial or malformed chunks
            }
          }
        }
      });

      mlResponse.data.on('end', async () => {
        cleanupTempFile();
        
        // Append extracted PDF/DOCX text to userMessage content in DB for context persistence
        if (extractedFileText) {
          try {
            userMessage.content += `\n\n[Attached file content]:\n${extractedFileText}`;
            await userMessage.save();
          } catch (userMsgErr) {
            console.error('Error updating user message with extracted file content:', userMsgErr.message);
          }
        }

        try {
          const tierBaseCosts = { lite: 4, standard: 8, pro: 16 };
          const tLower = (tier || 'lite').toLowerCase();
          let costDeducted = tierBaseCosts[tLower] || 4;

          if (req.file) {
            user.dailyUploadsCount = (user.dailyUploadsCount || 0) + 1;
            const fn = (req.file.originalname || '').toLowerCase();
            const isImage = ['.png', '.jpg', '.jpeg', '.webp'].some(ext => fn.endsWith(ext));
            costDeducted += isImage ? 20 : 16;
          }

          user.dailyTokensUsed = (user.dailyTokensUsed || 0) + costDeducted;
          await user.save();

          // Send usage_update SSE event
          const activeMaxBudget = user.plan === 'pro' ? 5000 : 1000;
          res.write(`data: ${JSON.stringify({
            type: 'usage_update',
            content: {
              used: user.dailyTokensUsed,
              budget: activeMaxBudget,
              plan: user.plan
            }
          })}\n\n`);

          const assistantMessage = new Message({
            chatId: currentChatId,
            role: 'assistant',
            content: assistantResponseText || '[Empty Response]',
            sources: assistantSources,
            model_used: assistantModelUsed,
            verification: assistantVerification
          });
          await assistantMessage.save();
        } catch (dbError) {
          console.error('Error saving assistant message:', dbError.message);
        }
        res.end(); // Close the SSE connection
      });

      mlResponse.data.on('error', (err) => {
        cleanupTempFile();
        console.error('Error in ML stream:', err);
        res.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream error' })}\n\n`);
        res.end();
      });

    } catch (mlError) {
      cleanupTempFile();
      console.error('Error connecting to ML service:', mlError.message);
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Error communicating with ML service' })}\n\n`);
      res.end();
    }

  } catch (error) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Chat endpoint error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error', error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Server error' })}\n\n`);
      res.end();
    }
  }
});

// Get user chats (for sidebar)
router.get('/history', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user.id }).sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a specific chat
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, user: req.user.id });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit user message and delete subsequent messages
router.put('/:chatId/messages/:messageId', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const chat = await Chat.findOne({ _id: chatId, user: req.user.id });
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const targetMessage = await Message.findOne({ _id: messageId, chatId });
    if (!targetMessage) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (targetMessage.role !== 'user') {
      return res.status(400).json({ message: 'Only user messages can be edited' });
    }

    targetMessage.content = content.trim();
    await targetMessage.save();

    // Delete all messages in this chat created after the target message
    await Message.deleteMany({
      chatId,
      createdAt: { $gt: targetMessage.createdAt }
    });

    res.json({
      message: 'Message updated and subsequent messages truncated',
      updatedMessage: targetMessage
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear all user chat history
router.delete('/all', auth, async (req, res) => {
  try {
    const userChats = await Chat.find({ user: req.user.id });
    const chatIds = userChats.map(c => c._id);

    if (chatIds.length > 0) {
      await Message.deleteMany({ chatId: { $in: chatIds } });
      await Chat.deleteMany({ user: req.user.id });
    }

    res.json({ message: 'All chat history deleted successfully' });
  } catch (error) {
    console.error('Error clearing all chat history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

