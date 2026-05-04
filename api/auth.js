const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getPool } = require('../lib/db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';

// Middleware: verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const pool = getPool();
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM user WHERE email = ? OR username = ?', [email, username]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: 'Email or username already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO user (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.insertId, username, email, role: 'user' },
      JWT_SECRET, { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: result.insertId, username, email, role: 'user' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const pool = getPool();
  try {
    const [users] = await pool.execute(
      'SELECT * FROM user WHERE email = ?', [email]
    );
    if (users.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    if (!user.password)
      return res.status(401).json({ error: 'Please login with Google' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Google OAuth Login
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google credential required' });

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    const pool = getPool();
    let [users] = await pool.execute('SELECT * FROM user WHERE google_id = ? OR email = ?', [googleId, email]);

    let user;
    if (users.length === 0) {
      const username = name.replace(/\s+/g, '_').toLowerCase() + '_' + Math.random().toString(36).substr(2, 5);
      const [result] = await pool.execute(
        'INSERT INTO user (username, email, google_id, avatar) VALUES (?, ?, ?, ?)',
        [username, email, googleId, picture]
      );
      user = { id: result.insertId, username, email, role: 'user', avatar: picture };
    } else {
      user = users[0];
      if (!user.google_id) {
        await pool.execute('UPDATE user SET google_id = ?, avatar = ? WHERE id = ?', [googleId, picture, user.id]);
      }
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );

    res.json({
      message: 'Google login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar || picture }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Get profile
router.get('/profile', verifyToken, async (req, res) => {
  const pool = getPool();
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, avatar, role, created_at FROM user WHERE id = ?', [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken;
