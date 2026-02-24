import express from 'express';
import bcrypt from 'bcrypt';

import User from '../models/User.js';
import { requireAuth, requireManager } from '../middleware/auth.js';

export const router = express.Router();

// Home
router.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/profile');
  res.redirect('/login');
});

/* -----------------------------
  AUTH: Register / Login / Logout
------------------------------ */

// Register form
router.get('/register', (req, res) => {
  res.render('auth/register', { error: null, form: {} });
});

// Register submit
router.post('/register', async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password || '';

    const form = { name, email };

    if (!name || !email || !password) {
      return res.render('auth/register', { error: 'All fields are required.', form });
    }

    if (password.length < 8) {
      return res.render('auth/register', { error: 'Password must be at least 8 characters.', form });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.render('auth/register', { error: 'That email is already registered.', form });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // First user becomes manager (nice for classroom demos)
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'manager' : 'user';

    const user = await User.create({ name, email, passwordHash, role });

    req.session.userId = user._id.toString();
    req.session.role = user.role;

    res.redirect('/profile');
  } catch (err) {
    next(err);
  }
});

// Login form
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null, form: {} });
});

// Login submit
router.post('/login', async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password || '';

    const form = { email };

    if (!email || !password) {
      return res.render('auth/login', { error: 'Email and password are required.', form });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/login', { error: 'Invalid login.', form });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.render('auth/login', { error: 'Invalid login.', form });
    }

    req.session.userId = user._id.toString();
    req.session.role = user.role;

    res.redirect('/profile');
  } catch (err) {
    next(err);
  }
});

// Logout
router.get('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

/* -----------------------------
  PROFILE
------------------------------ */

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    // currentUser is already on res.locals from attachCurrentUser middleware
    res.render('user/profile');
  } catch (err) {
    next(err);
  }
});

/* -----------------------------
  MANAGER: User management
------------------------------ */

// User table
router.get('/manager/users', requireManager, async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('name email role createdAt');
    res.render('manager/users', { users });
  } catch (err) {
    next(err);
  }
});

// Edit form
router.get('/manager/users/:id/edit', requireManager, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email role');
    if (!user) return res.redirect('/manager/users');

    res.render('manager/editUser', { user, error: null });
  } catch (err) {
    next(err);
  }
});

// Update user (name/email/role)
router.post('/manager/users/:id/update', requireManager, async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const role = req.body.role;

    if (!name || !email || !['user', 'manager'].includes(role)) {
      const user = await User.findById(req.params.id).select('name email role');
      return res.render('manager/editUser', { user, error: 'Please enter valid values.' });
    }

    // Prevent email collisions
    const emailOwner = await User.findOne({ email });
    if (emailOwner && emailOwner._id.toString() !== req.params.id) {
      const user = await User.findById(req.params.id).select('name email role');
      return res.render('manager/editUser', { user, error: 'That email is already in use.' });
    }

    await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role },
      { runValidators: true }
    );

    // If manager edits their own role, update session role too
    if (req.session.userId === req.params.id) {
      req.session.role = role;
    }

    res.redirect('/manager/users');
  } catch (err) {
    next(err);
  }
});

// Delete user
router.post('/manager/users/:id/delete', requireManager, async (req, res, next) => {
  try {
    // Safety: prevent deleting yourself (common classroom foot-gun)
    if (req.session.userId === req.params.id) {
      return res.status(400).send("You can't delete your own account while logged in.");
    }

    await User.findByIdAndDelete(req.params.id);
    res.redirect('/manager/users');
  } catch (err) {
    next(err);
  }
});