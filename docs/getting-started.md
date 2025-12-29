# Getting Started with Relay

This guide will help you get started with Relay for integrating messaging providers into your Node.js application.

## Installation

```bash
npm install @relay/core
```

## Basic Usage

### 1. Initialize a Provider

```javascript
const { UnipileProvider } = require('@relay/core');

const unipile = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Check if properly configured
if (!unipile.isInitialized()) {
  console.error('Provider error:', unipile.getError());
}
```

### 2. Send Messages

```javascript
// Send to a new conversation
await unipile.messaging.send({
  account_id: 'acc_123',
  user_id: 'user_456',
  text: 'Hello!'
});

// Send to an existing chat
await unipile.messaging.sendMessage({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  text: 'Follow-up message'
});
```

### 3. Handle Webhooks

```javascript
const { parseWebhook, EventTypes } = require('@relay/core');

app.post('/webhooks/unipile', (req, res) => {
  const event = parseWebhook('unipile', req.body);

  switch (event.type) {
    case EventTypes.MESSAGE_RECEIVED:
      console.log('New message from:', event.senderName);
      console.log('Content:', event.content);
      break;

    case EventTypes.RELATION_CREATED:
      console.log('New connection:', event.metadata.relation.firstName);
      break;
  }

  res.status(200).send('OK');
});
```

### 4. Use Event Emitter (Recommended)

```javascript
const { MessagingEventEmitter, EventTypes, parseWebhook } = require('@relay/core');

const emitter = new MessagingEventEmitter();

// Register handlers
emitter.on(EventTypes.MESSAGE_RECEIVED, async (event, context) => {
  console.log('Message:', event.content);
  return { processed: true };
});

// In your webhook handler
app.post('/webhooks/unipile', async (req, res) => {
  const event = parseWebhook('unipile', req.body);
  await emitter.emit(event, { req, res });
  res.status(200).send('OK');
});
```

## Next Steps

- [Providers Documentation](./providers.md)
- [Events Reference](./events.md)
- [Webhooks Guide](./webhooks.md)
- [Queue Integration](./queue.md)
