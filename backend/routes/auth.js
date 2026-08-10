const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { Resend } = require('resend');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_super_secret_refresh_token_key_here';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const issueTokens = async (user) => {
  const accessToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user._id }, REFRESH_TOKEN_SECRET, { expiresIn: '30d' });

  const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  if (!Array.isArray(user.refreshTokens)) {
    user.refreshTokens = [];
  }
  user.refreshTokens.push(hashedRefreshToken);
  await user.save();

  return { accessToken, refreshToken };
};

const generateRecoveryCodes = () => {
  const rawCodes = [];
  const hashedCodes = [];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 8; i++) {
    let part1 = '';
    let part2 = '';
    for (let j = 0; j < 4; j++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const rawCode = `${part1}-${part2}`;
    const hashedCode = crypto.createHash('sha256').update(rawCode).digest('hex');
    rawCodes.push(rawCode);
    hashedCodes.push(hashedCode);
  }
  return { rawCodes, hashedCodes };
};

const formatUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  plan: user.plan,
  dailyTokensUsed: user.dailyTokensUsed || 0,
  dailyUploadsCount: user.dailyUploadsCount || 0,
  usageResetAt: user.usageResetAt,
  authProvider: user.authProvider || 'local',
  hasLocalPassword: Boolean(user.hasLocalPassword || user.password),
  recoveryCodesCount: Array.isArray(user.recoveryCodes) ? user.recoveryCodes.length : 0,
});

// Middleware to protect routes - defined early so every route below can use it
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

// 1. Local Signup
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validate Name
    if (!name || typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ message: 'Name is required and must be under 100 characters' });
    }

    // Validate Email format
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Validate Password length
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { rawCodes, hashedCodes } = generateRecoveryCodes();

    const newUser = new User({
      email: cleanEmail,
      password: hashedPassword,
      name: cleanName,
      authProvider: 'local',
      hasLocalPassword: true,
      recoveryCodes: hashedCodes,
    });
    await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      recoveryCodes: rawCodes
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 2. Local Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = await issueTokens(user);
    res.json({ accessToken, refreshToken, user: formatUserPayload(user) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 3. Google OAuth Login/Signup
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid Google credential token' });
    }

    const cleanEmail = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || cleanEmail.split('@')[0];

    let user = await User.findOne({ email: cleanEmail });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      user = new User({
        email: cleanEmail,
        name: name,
        authProvider: 'google',
        googleId: googleId,
        hasLocalPassword: false,
      });
      await user.save();
    }

    const { accessToken, refreshToken } = await issueTokens(user);
    res.json({ accessToken, refreshToken, user: formatUserPayload(user) });
  } catch (error) {
    console.error('Error in Google auth:', error);
    res.status(500).json({ message: 'Google authentication failed', error: error.message });
  }
});

// 4. Send OTP Code for Passwordless Login
router.post('/send-otp', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const genericMsg = 'If an account exists for this email, a login code has been sent.';

    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(200).json({ message: genericMsg });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpCode = otpCode;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: 'AI Assistant <onboarding@resend.dev>',
          to: [cleanEmail],
          subject: 'Your login code',
          html: `<p>Your login code is: <strong>${otpCode}</strong></p><p>Expires in 10 minutes.</p>`
        });
        if (error) {
          console.error('Resend OTP email error:', error);
        }
      }
    }

    return res.status(200).json({ message: genericMsg });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(200).json({ message: 'If an account exists for this email, a login code has been sent.' });
  }
});

// 5. Verify OTP & Login
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and login code are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ message: 'Invalid or expired login code' });
    }

    if (user.otpCode !== code.trim() || new Date() > new Date(user.otpExpiresAt)) {
      return res.status(400).json({ message: 'Invalid or expired login code' });
    }

    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.isVerified = true;
    await user.save();

    const { accessToken, refreshToken } = await issueTokens(user);
    return res.json({ accessToken, refreshToken, user: formatUserPayload(user) });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

// 6. Forgot Password (Request Link)
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const genericMsg = 'If an account exists for this email, a password reset link has been sent.';

    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(200).json({ message: genericMsg });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user && (user.authProvider === 'local' || user.hasLocalPassword || user.password)) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const resetUrl = `http://localhost:5173/reset-password/${rawToken}`;
        const { error } = await resend.emails.send({
          from: 'AI Assistant <onboarding@resend.dev>',
          to: [cleanEmail],
          subject: 'Reset your password',
          html: `<p><a href="${resetUrl}">Reset your password</a></p><p>Expires in 1 hour.</p>`
        });
        if (error) {
          console.error('Resend reset password email error:', error);
        }
      }
    }

    return res.status(200).json({ message: genericMsg });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return res.status(200).json({ message: 'If an account exists for this email, a password reset link has been sent.' });
  }
});

// 7. Reset Password via Token
router.post('/reset-password/:token', authLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.hasLocalPassword = true;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password reset successful! You can now log in.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ message: 'Server error resetting password' });
  }
});

// 7.1 Recover Password via Backup Recovery Code
router.post('/recover-with-code', authLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const genericMsg = 'Invalid recovery code';

    if (!email || !code || !newPassword || typeof email !== 'string' || typeof code !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: genericMsg });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();
    const hashedCode = crypto.createHash('sha256').update(cleanCode).digest('hex');

    const user = await User.findOne({ email: cleanEmail });
    if (!user || !Array.isArray(user.recoveryCodes) || !user.recoveryCodes.includes(hashedCode)) {
      return res.status(400).json({ message: genericMsg });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.hasLocalPassword = true;
    user.recoveryCodes = user.recoveryCodes.filter(c => c !== hashedCode);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password recovered successfully! You can now log in with your new password.' });
  } catch (error) {
    console.error('Error recovering password with code:', error);
    return res.status(400).json({ message: 'Invalid recovery code' });
  }
});

// 7.2 Regenerate Backup Recovery Codes
router.post('/regenerate-recovery-codes', auth, async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required to regenerate recovery codes' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.password) {
      return res.status(400).json({ message: 'No local password set for this account' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const { rawCodes, hashedCodes } = generateRecoveryCodes();
    user.recoveryCodes = hashedCodes;
    await user.save();

    return res.json({
      message: 'New recovery codes generated successfully',
      recoveryCodes: rawCodes,
      user: formatUserPayload(user)
    });
  } catch (error) {
    console.error('Error regenerating recovery codes:', error);
    return res.status(500).json({ message: 'Server error regenerating recovery codes' });
  }
});


// 7a. Refresh Access Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Refresh token invalid or expired' });
    }

    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const user = await User.findById(decoded.id);

    if (!user || !Array.isArray(user.refreshTokens) || !user.refreshTokens.includes(hashedToken)) {
      return res.status(401).json({ message: 'Refresh token revoked or invalid' });
    }

    const newAccessToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Error in refresh endpoint:', error);
    return res.status(500).json({ message: 'Server error during token refresh' });
  }
});

// 7b. Logout & Revoke Refresh Token
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const user = await User.findById(decoded.id);
        if (user && Array.isArray(user.refreshTokens)) {
          user.refreshTokens = user.refreshTokens.filter(t => t !== hashedToken);
          await user.save();
        }
      } catch (err) {
        // Ignore token verification error on logout
      }
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout endpoint:', error);
    return res.status(500).json({ message: 'Server error during logout' });
  }
});

// 8. Set Local Password for Google Accounts
router.post('/set-password', auth, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.hasLocalPassword && user.password) {
      return res.status(400).json({ message: 'Account already has a local password. Use Change Password instead.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.hasLocalPassword = true;
    await user.save();

    return res.json({
      message: 'Local password set successfully! You can now log in with email and password.',
      user: formatUserPayload(user)
    });
  } catch (error) {
    console.error('Error setting password:', error);
    return res.status(500).json({ message: 'Server error setting password' });
  }
});

// Get current user profile with token usage
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check calendar reset
    const now = new Date();
    if (new Date(user.usageResetAt).toDateString() !== now.toDateString()) {
      user.dailyTokensUsed = 0;
      user.dailyUploadsCount = 0;
      user.usageResetAt = now;
      await user.save();
    }

    res.json(formatUserPayload(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle user plan between 'free' and 'pro' (Demo)
router.post('/toggle-plan', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.plan = user.plan === 'pro' ? 'free' : 'pro';
    await user.save();

    res.json({
      message: `Plan toggled to ${user.plan}`,
      user: formatUserPayload(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Change Password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.password) {
      return res.status(400).json({ message: 'No password exists for this user. Please use Set Password.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.hasLocalPassword = true;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;b