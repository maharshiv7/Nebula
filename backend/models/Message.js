const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  sources: [{
    title: String,
    url: String
  }],
  model_used: {
    type: String,
    default: "openai/gpt-oss-120b"
  },
  verification: {
    status: String,
    message: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
