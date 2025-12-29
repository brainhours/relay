/**
 * Example: Express Webhook Handler with @relay/core
 *
 * This example shows how to:
 * 1. Initialize the Unipile provider
 * 2. Set up webhook handling
 * 3. Process different event types
 * 4. Use the event emitter pattern
 */

const express = require('express');
const {
  UnipileProvider,
  parseWebhook,
  EventTypes,
  MessagingEventEmitter
} = require('@relay/core');

// Initialize Express
const app = express();
app.use(express.json());

// Initialize the Unipile provider
const unipile = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Check if provider is initialized
if (!unipile.isInitialized()) {
  console.error('Unipile provider not initialized:', unipile.getError());
  process.exit(1);
}

// Create event emitter for handling events
const emitter = new MessagingEventEmitter();

// Register event handlers
emitter.on(EventTypes.MESSAGE_RECEIVED, async (event, context) => {
  console.log('📨 New message received!');
  console.log('  From:', event.senderName || event.senderId);
  console.log('  Content:', event.content);
  console.log('  Provider:', event.providerType);

  // Example: Auto-reply to messages
  if (event.content && event.content.toLowerCase().includes('hello')) {
    try {
      await unipile.messaging.sendMessage({
        account_id: event.accountId,
        chat_id: event.chatId,
        text: 'Hello! Thanks for your message. How can I help you?'
      });
      console.log('  ✅ Auto-reply sent');
    } catch (error) {
      console.error('  ❌ Failed to send reply:', error.message);
    }
  }

  return { processed: true };
});

emitter.on(EventTypes.RELATION_CREATED, async (event, context) => {
  console.log('🤝 New connection!');
  console.log('  User:', event.metadata?.relation?.firstName);
  console.log('  Profile:', event.metadata?.relation?.profileUrl);

  return { processed: true };
});

emitter.on(EventTypes.ACCOUNT_CONNECTED, async (event, context) => {
  console.log('✅ Account connected!');
  console.log('  Account ID:', event.accountId);
  console.log('  Provider:', event.providerType);

  return { processed: true };
});

// Webhook endpoint
app.post('/webhooks/unipile', async (req, res) => {
  try {
    // Parse the webhook to a normalized event
    const event = parseWebhook('unipile', req.body);

    console.log(`\n📥 Webhook received: ${event.type}`);

    // Emit to handlers
    const results = await emitter.emit(event, { req, res });

    // Check if any handler processed the event
    const processed = results.some(r => r.success && r.result?.processed);

    console.log(`  Processed: ${processed}`);

    // Always return 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      eventType: event.type,
      processed
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: unipile.isInitialized() ? 'connected' : 'not configured'
  });
});

// Example API endpoints
app.get('/api/chats', async (req, res) => {
  try {
    const { account_id } = req.query;

    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    const chats = await unipile.messaging.getChats({ account_id });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { account_id, chat_id, text } = req.body;

    if (!account_id || !chat_id || !text) {
      return res.status(400).json({
        error: 'account_id, chat_id, and text are required'
      });
    }

    const result = await unipile.messaging.sendMessage({
      account_id,
      chat_id,
      text
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Relay example server running on port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /webhooks/unipile - Webhook handler`);
  console.log(`  GET  /health           - Health check`);
  console.log(`  GET  /api/chats        - List chats`);
  console.log(`  POST /api/messages     - Send message`);
});
