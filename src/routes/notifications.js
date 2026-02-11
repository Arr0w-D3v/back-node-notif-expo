const express = require('express');
const { Expo } = require('expo-server-sdk');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const expo = new Expo();

// Send notification to a specific user
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'userId, title et body sont requis' });
    }

    const user = await db.getAsync('SELECT expo_push_token FROM users WHERE id = ?', [userId]);

    if (!user || !user.expo_push_token) {
      return res.status(400).json({ error: 'Utilisateur non trouvé ou push token non enregistré' });
    }

    if (!Expo.isExpoPushToken(user.expo_push_token)) {
      return res.status(400).json({ error: 'Push token invalide' });
    }

    const message = {
      to: user.expo_push_token,
      sound: 'default',
      title,
      body,
      data: data || {}
    };

    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // Save notification
    const result = await db.runAsync(
      'INSERT INTO notifications (user_id, title, body, data, status, ticket_id, sent_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [
        userId,
        title,
        body,
        JSON.stringify(data || {}),
        tickets[0]?.status || 'error',
        tickets[0]?.id || null
      ]
    );

    res.json({
      message: 'Notification envoyée',
      notificationId: result.lastID,
      ticket: tickets[0]
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la notification' });
  }
});

// Send notification to multiple users
router.post('/send-bulk', authMiddleware, async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      return res.status(400).json({ error: 'userIds (array), title et body sont requis' });
    }

    const placeholders = userIds.map(() => '?').join(',');
    const users = await db.allAsync(
      `SELECT id, expo_push_token FROM users WHERE id IN (${placeholders}) AND expo_push_token IS NOT NULL`,
      userIds
    );

    const messages = users
      .filter(user => Expo.isExpoPushToken(user.expo_push_token))
      .map(user => ({
        to: user.expo_push_token,
        sound: 'default',
        title,
        body,
        data: { ...data, userId: user.id }
      }));

    if (messages.length === 0) {
      return res.status(400).json({ error: 'Aucun utilisateur avec un push token valide' });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // Save notifications
    for (let i = 0; i < users.length; i++) {
      await db.runAsync(
        'INSERT INTO notifications (user_id, title, body, data, status, ticket_id, sent_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [
          users[i].id,
          title,
          body,
          JSON.stringify(data || {}),
          tickets[i]?.status || 'error',
          tickets[i]?.id || null
        ]
      );
    }

    res.json({
      message: `${tickets.length} notifications envoyées`,
      tickets
    });
  } catch (error) {
    console.error('Send bulk notification error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi des notifications' });
  }
});

// Send notification to all users
router.post('/send-all', authMiddleware, async (req, res) => {
  try {
    const { title, body, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'title et body sont requis' });
    }

    const users = await db.allAsync(
      'SELECT id, expo_push_token FROM users WHERE expo_push_token IS NOT NULL'
    );

    const messages = users
      .filter(user => Expo.isExpoPushToken(user.expo_push_token))
      .map(user => ({
        to: user.expo_push_token,
        sound: 'default',
        title,
        body,
        data: { ...data, userId: user.id }
      }));

    if (messages.length === 0) {
      return res.status(400).json({ error: 'Aucun utilisateur avec un push token valide' });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    res.json({
      message: `${tickets.length} notifications envoyées à tous les utilisateurs`,
      count: tickets.length
    });
  } catch (error) {
    console.error('Send all notification error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi des notifications' });
  }
});

// Get notification history for current user
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const notifications = await db.allAsync(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.userId]
    );

    res.json({ notifications });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
