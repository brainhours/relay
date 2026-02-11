# Events

Relay normalizes events from all providers into a consistent format.

## Event Types

```javascript
const { EventTypes } = require('@guilhermegoulart1/relay-core');

// Message events
EventTypes.MESSAGE_RECEIVED     // Incoming message
EventTypes.MESSAGE_SENT         // Outgoing message
EventTypes.MESSAGE_DELIVERED    // Message was delivered
EventTypes.MESSAGE_READ         // Message was read
EventTypes.MESSAGE_EDITED       // Message was edited
EventTypes.MESSAGE_DELETED      // Message was deleted
EventTypes.MESSAGE_REACTION     // Reaction added/removed

// Relation events
EventTypes.RELATION_CREATED     // New connection/follow
EventTypes.RELATION_REMOVED     // Disconnection/unfollow

// Account events
EventTypes.ACCOUNT_CONNECTED       // Account connected
EventTypes.ACCOUNT_DISCONNECTED    // Account disconnected
EventTypes.ACCOUNT_STATUS          // Account status update
```

## Parsing Webhooks

Use `parseWebhook` to normalize incoming webhook payloads:

```javascript
const { parseWebhook, EventTypes } = require('@guilhermegoulart1/relay-core');

app.post('/webhooks/unipile', (req, res) => {
  const event = parseWebhook('unipile', req.body);

  switch (event.type) {
    case EventTypes.MESSAGE_RECEIVED:
      console.log('New message from:', event.senderId);
      console.log('Content:', event.content);
      break;

    case EventTypes.RELATION_CREATED:
      console.log('New connection:', event.userId);
      break;

    case EventTypes.ACCOUNT_CONNECTED:
      console.log('Account connected:', event.accountId);
      break;
  }

  res.status(200).send('OK');
});
```

## Normalized Event Structure

All events are normalized to this structure:

```javascript
{
  type: 'message_received',       // Event type
  provider: 'unipile',            // Provider name
  providerType: 'LINKEDIN',       // Channel type (LINKEDIN, WHATSAPP, etc.)
  accountId: 'acc_123',           // Provider account ID
  chatId: 'chat_456',             // Chat ID (for message events)
  messageId: 'msg_789',           // Message ID (for message events)
  senderId: 'user_abc',           // Sender ID
  senderName: 'John Doe',         // Sender name
  content: 'Hello!',              // Message content
  timestamp: Date,                // Event timestamp
  attachments: [],                // Normalized attachments
  metadata: {},                   // Provider-specific data
  raw: {}                         // Original webhook payload
}
```

### Helper Methods

```javascript
event.isMessageEvent();    // true for MESSAGE_* events
event.isRelationEvent();   // true for RELATION_* events
event.isAccountEvent();    // true for ACCOUNT_* events
event.getUniqueId();       // 'unipile:message_received:acc_123:msg_789'
event.toJSON();            // Plain object representation
```

## Provider Types

```javascript
const { ProviderTypes } = require('@guilhermegoulart1/relay-core');

ProviderTypes.LINKEDIN
ProviderTypes.WHATSAPP
ProviderTypes.INSTAGRAM
ProviderTypes.MESSENGER
ProviderTypes.TELEGRAM
ProviderTypes.TWITTER
ProviderTypes.EMAIL
ProviderTypes.SMS
```

## Event Emitter

Use `MessagingEventEmitter` for event-driven handling:

```javascript
const { MessagingEventEmitter, EventTypes, parseWebhook } = require('@guilhermegoulart1/relay-core');

const emitter = new MessagingEventEmitter();

// Register handler for specific event
emitter.on(EventTypes.MESSAGE_RECEIVED, async (event, context) => {
  console.log('Message:', event.content);
  return { handled: true };
});

// Register handler for all events
emitter.onAll(async (event, context) => {
  console.log('Event:', event.type);
});

// Add middleware
emitter.use(async (event, context, next) => {
  console.log('Before handlers');
  next(); // Continue to handlers
});

// Emit event
const results = await emitter.emit(event, { db, services });

// Cleanup
emitter.off(EventTypes.MESSAGE_RECEIVED);
emitter.removeAllListeners();
```

## Default Emitter

Use the singleton emitter for simple applications:

```javascript
const { getDefaultEmitter, EventTypes } = require('@guilhermegoulart1/relay-core');

const emitter = getDefaultEmitter();
emitter.on(EventTypes.MESSAGE_RECEIVED, handler);
```

## Complete Example

```javascript
const express = require('express');
const {
  UnipileProvider,
  parseWebhook,
  EventTypes,
  MessagingEventEmitter
} = require('@guilhermegoulart1/relay-core');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize provider
const provider = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Create event emitter
const emitter = new MessagingEventEmitter();

// Register handlers
emitter.on(EventTypes.MESSAGE_RECEIVED, async (event, context) => {
  console.log(`Message from ${event.senderName}: ${event.content}`);

  // Auto-reply
  await provider.messaging.sendMessage({
    account_id: event.accountId,
    chat_id: event.chatId,
    text: 'Thanks for your message!'
  });
});

emitter.on(EventTypes.RELATION_CREATED, async (event) => {
  console.log('New connection:', event.userId);
});

// Webhook endpoint
app.post('/webhooks/unipile', async (req, res) => {
  try {
    const event = parseWebhook('unipile', req.body);
    await emitter.emit(event, { provider });
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```
