const rateLimit = require('express-rate-limit');

// Rate limiter for auth routes (login/signup): max 10 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for chat routes: max 30 requests per 15 minutes
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { message: 'Too many chat requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authLimiter,
  chatLimiter
};
