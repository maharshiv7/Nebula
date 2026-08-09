const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
  plan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free',
  },
  dailyTokensUsed: {
    type: Number,
    default: 0,
  },
  usageResetAt: {
    type: Date,
    default: Date.now,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  hasLocalPassword: {
    type: Boolean,
    default: false,
  },
  otpCode: {
    type: String,
  },
  otpExpiresAt: {
    type: Date,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  refreshTokens: {
    type: [String],
    default: [],
  },
  dailyUploadsCount: {
    type: Number,
    default: 0,
  },
  recoveryCodes: {
    type: [String],
    default: [],
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
  },
  verificationExpires: {
    type: Date,
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
