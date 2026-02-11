const { Expo } = require('expo-server-sdk');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const expo = new Expo();
const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

const TITLE = process.argv[2] || 'Notification';
const BODY = process.argv[3] || 'Vous avez un nouveau message';

async function sendToAll() {
  // Récupérer tous les users avec un push token
  db.all(
    'SELECT id, email, expo_push_token FROM users WHERE expo_push_token IS NOT NULL',
    async (err, users) => {
      if (err) {
        console.error('❌ Erreur DB:', err);
        return;
      }

      if (!users || users.length === 0) {
        console.log('❌ Aucun utilisateur avec un push token');
        return;
      }

      console.log(`📱 ${users.length} utilisateur(s) trouvé(s)`);

      // Créer les messages
      const messages = users
        .filter(user => Expo.isExpoPushToken(user.expo_push_token))
        .map(user => ({
          to: user.expo_push_token,
          sound: 'default',
          title: TITLE,
          body: BODY,
        }));

      // Envoyer par chunks
      const chunks = expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        console.log('✅ Envoyé:', tickets);
      }

      console.log(`🎉 ${messages.length} notification(s) envoyée(s)`);
    }
  );
}

sendToAll();
