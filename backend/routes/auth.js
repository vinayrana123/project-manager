/**
 * Authentication Routes
 * POST /api/auth/register  — Create new account
 * POST /api/auth/login     — Login with email/password
 * GET  /api/auth/me        — Get current user profile
 * PUT  /api/auth/profile   — Update profile
 * PUT  /api/auth/password  — Change password
 *
 * FIXES APPLIED:
 *  1. Removed normalizeEmail() from register validation — it applies Gmail-
 *     specific transforms (dots, plus-addressing) that differ from Mongoose's
 *     simple lowercase(), producing mismatched lookups and false 409 conflicts.
 *     We now rely solely on the schema's `lowercase: true` to canonicalise
 *     the email consistently at the DB layer.
 *  2. Register duplicate check now lowercases the incoming email explicitly
 *     before querying so it matches what Mongoose stored.
 *  3. Login likewise lowercases before querying.
 *  4. 409 response includes the conflicting field for clearer client messages.
 */

const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const { protect, generateToken } = require('../middleware/auth');

// ─── Validation rules ─────────────────────────────────────────────────────────
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 })
    .withMessage('Name must be 2–50 characters'),
  // NOTE: do NOT use .normalizeEmail() here — it applies Gmail-specific
  // transforms that differ from Mongoose's schema-level lowercase, which
  // causes the pre-save duplicate check to miss already-stored addresses.
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

const loginValidation = [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// ─── Helper: surface validation errors ───────────────────────────────────────
const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return true; // signals "there was an error"
  }
  return false;
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', registerValidation, async (req, res) => {
  try {
    if (handleValidation(req, res)) return;

    const { name, password } = req.body;
    // Canonicalise email the same way Mongoose will store it
    const email = req.body.email.toLowerCase().trim();

    // Duplicate check against the canonicalised form
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        field: 'email',
        message: 'An account with this email already exists. Please log in instead.'
      });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: user.toSafeObject()
    });

  } catch (err) {
    // Mongoose unique-index race condition fallback
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        field: 'email',
        message: 'An account with this email already exists. Please log in instead.'
      });
    }
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', loginValidation, async (req, res) => {
  try {
    if (handleValidation(req, res)) return;

    // Canonicalise email to match stored form
    const email    = req.body.email.toLowerCase().trim();
    const password = req.body.password;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: user.toSafeObject()
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    console.error('/me error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put('/profile', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 })
], async (req, res) => {
  try {
    const { name, preferences } = req.body;
    const updates = {};
    if (name)        updates.name        = name;
    if (preferences) updates.preferences = { ...req.user.preferences?.toObject?.() || {}, ...preferences };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ success: true, message: 'Profile updated', user: user.toSafeObject() });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/auth/password ───────────────────────────────────────────────────
router.put('/password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    if (handleValidation(req, res)) return;

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    const token = generateToken(user._id);
    res.json({ success: true, message: 'Password changed successfully', token });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
