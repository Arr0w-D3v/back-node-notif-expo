const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = db.prepare(
      'INSERT INTO users (email, password) VALUES (?, ?)'
    ).run(email, hashedPassword);

    const token = jwt.sign(
      { userId: result.lastInsertRowid, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      token,
      user: { id: result.lastInsertRowid, email }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, expo_push_token, created_at FROM users WHERE id = ?').get(req.user.userId);

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.json({ user });
});

// Update push token
router.post('/push-token', authMiddleware, (req, res) => {
  const { pushToken } = req.body;

  if (!pushToken) {
    return res.status(400).json({ error: 'Push token requis' });
  }

  db.prepare('UPDATE users SET expo_push_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(pushToken, req.user.userId);

  res.json({ message: 'Push token enregistré' });
});

module.exports = router;
