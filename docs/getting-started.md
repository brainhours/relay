# Getting Started with Relay

This guide will help you get started with Relay for integrating messaging providers into your Node.js application.

## Installation

```bash
npm install @brainhours/relay-core
```

No registry setup or authentication needed — the package is published publicly
on [npmjs.com](https://www.npmjs.com/package/@brainhours/relay-core).

### Requirements

- Node.js >= 18.0.0
- Unipile API credentials (DSN + Access Token)

## Environment Setup

Create a `.env` file in your project root:

```env
# Required - Unipile Configuration
UNIPILE_DSN=api1.unipile.com:13111
UNIPILE_ACCESS_TOKEN=your_access_token_here

# Optional - For webhook handling
BACKEND_URL=https://your-api.com
FRONTEND_URL=https://your-app.com
```

### Getting Unipile Credentials

1. Go to [Unipile Dashboard](https://app.unipile.com)
2. Create an account or sign in
3. Navigate to **Settings > API**
4. Copy your **DSN** and **Access Token**

## Basic Usage

### 1. Initialize a Provider

```javascript
const { UnipileProvider } = require('@brainhours/relay-core');
require('dotenv').config();

const provider = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Check if properly configured
if (!provider.isInitialized()) {
  console.error('Provider error:', provider.getError());
  process.exit(1);
}

console.log('Relay initialized successfully!');
```

### 2. Send Messages

```javascript
// Send to a new conversation
await provider.messaging.send({
  account_id: 'acc_123',
  user_id: 'user_456',
  text: 'Hello!'
});

// Send to an existing chat
await provider.messaging.sendMessage({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  text: 'Follow-up message'
});
```

### 3. Handle Webhooks

```javascript
const { parseWebhook, EventTypes } = require('@brainhours/relay-core');

app.post('/webhooks/unipile', (req, res) => {
  const event = parseWebhook('unipile', req.body);

  switch (event.type) {
    case EventTypes.MESSAGE_RECEIVED:
      console.log('New message from:', event.senderId);
      console.log('Content:', event.content);
      break;

    case EventTypes.RELATION_CREATED:
      console.log('New connection accepted');
      break;
  }

  res.status(200).send('OK');
});
```

### 4. Use Event Emitter (Recommended)

```javascript
const { MessagingEventEmitter, EventTypes, parseWebhook } = require('@brainhours/relay-core');

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

- [Providers Documentation](./providers.md) - Detailed provider configuration
- [Events Reference](./events.md) - Event types and handling
- [Core README](../packages/core/README.md) - Complete API reference
