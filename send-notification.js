const { Expo } = require('expo-server-sdk');
const Database = require('better-sqlite3');
const path = require('path');

const expo = new Expo();
const db = new Database(path.join(__dirname, 'data.db'));

const TITLE = process.argv[2] || 'Notification';
const BODY = process.argv[3] || 'Vous avez un nouveau message';

async function sendToAll() {
  // Récupérer tous les users avec un push token
  const users = db.prepare(
    'SELECT id, email, expo_push_token FROM users WHERE expo_push_token IS NOT NULL'
  ).all();

  if (users.length === 0) {
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

sendToAll();
