import User from '../models/User.js';

export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

export function requireManager(req, res, next) {
  if (!req.session.userId || req.session.role !== 'manager') {
    return res.status(403).send('Forbidden: managers only');
  }
  next();
}

// Optional: attach current user to res.locals for templates
export async function attachCurrentUser(req, res, next) {
  try {
    res.locals.currentUser = null;

    if (req.session.userId) {
      const user = await User.findById(req.session.userId).select('name email role');
      if (user) res.locals.currentUser = user;
    }

    next();
  } catch (err) {
    next(err);
  }
}