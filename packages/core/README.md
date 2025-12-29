# @relay/core

Core package for Relay - unified messaging integrations for Node.js.

## Installation

```bash
npm install @relay/core
```

## Features

- **Providers**: Unipile (Twilio, Uazapi coming soon)
- **Normalized Events**: Consistent event format across all providers
- **Webhook Handling**: Built-in parsing and validation
- **Queue Helpers**: Optional Bull queue integration

## Quick Start

### Initialize a Provider

```javascript
const { UnipileProvider } = require('@relay/core');

const unipile = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});
```

### Send a Message

```javascript
await unipile.messaging.send({
  accountId: 'account_123',
  attendeeId: 'user_456',
  text: 'Hello!'
});
```

### Handle Webhooks

```javascript
const { parseWebhook, EventTypes } = require('@relay/core');

app.post('/webhooks/unipile', (req, res) => {
  const event = parseWebhook('unipile', req.body);

  if (event.type === EventTypes.MESSAGE_RECEIVED) {
    console.log('New message from:', event.senderId);
    console.log('Content:', event.content);
  }

  res.status(200).send('OK');
});
```

### Use with Bull Queue (Optional)

```javascript
const { createWebhookQueue, addWebhookJob } = require('@relay/core/queue');

const queue = createWebhookQueue(redisConnection);

// Add job to queue
await addWebhookJob(queue, event);

// Process jobs
queue.process(async (job) => {
  const { event } = job.data;
  // Handle event...
});
```

## API Reference

### Providers

#### UnipileProvider

```javascript
const provider = new UnipileProvider(config);

// Account management
provider.account.getHostedAuthLink(options)
provider.account.getById(accountId)
provider.account.disconnect(accountId)

// Users
provider.users.getOwnProfile(accountId)
provider.users.getOne(accountId, userId)
provider.users.search(accountId, params)

// Messaging
provider.messaging.send(options)
provider.messaging.getMessages(accountId, chatId, params)
provider.messaging.getChats(accountId, params)
```

### Events

```javascript
const { EventTypes } = require('@relay/core');

EventTypes.MESSAGE_RECEIVED    // Incoming message
EventTypes.MESSAGE_SENT        // Outgoing message
EventTypes.MESSAGE_DELIVERED   // Message delivered
EventTypes.MESSAGE_READ        // Message read
EventTypes.RELATION_CREATED    // New connection/relation
EventTypes.ACCOUNT_CONNECTED   // Account connected
EventTypes.ACCOUNT_DISCONNECTED // Account disconnected
```

## License

MIT
