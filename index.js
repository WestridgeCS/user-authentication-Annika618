import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import session from 'express-session';
import MongoStore from 'connect-mongo';

import { router } from './routes/routes.js';
import { attachCurrentUser } from './middleware/auth.js';

dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));

app.set('view engine', 'ejs');
app.set('views', './views');

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    httpOnly: true
    // secure: true  // turn on when using HTTPS
  }
}));

// Make currentUser available in EJS templates
app.use(attachCurrentUser);

// Routes
app.use('/', router);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Server error. Check terminal for details.');
});

const port = process.env.PORT || 3000;

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected');
  app.listen(port, () => console.log(`✅ http://localhost:${port}`));
}

start().catch(err => {
  console.error('❌ Startup failed:', err);
  process.exit(1);
});