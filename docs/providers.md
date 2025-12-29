# Providers

Relay supports multiple messaging providers through a unified interface.

## Available Providers

| Provider | Status | Channels |
|----------|--------|----------|
| Unipile | ✅ Stable | LinkedIn, WhatsApp, Instagram, Telegram, Messenger, Email |
| Twilio | 🚧 Coming | SMS, WhatsApp, Voice |
| Uazapi | 🚧 Coming | WhatsApp |

## Unipile Provider

### Configuration

```javascript
const { UnipileProvider } = require('@relay/core');

const unipile = new UnipileProvider({
  dsn: 'api1.unipile.com:13111',     // Your Unipile DSN
  accessToken: 'your-access-token',   // API access token
  timeout: 15000                      // Optional: request timeout in ms
});
```

### Account Management

```javascript
// Generate OAuth link for connecting accounts
const authLink = await unipile.account.getHostedAuthLink({
  providers: ['LINKEDIN', 'WHATSAPP'],
  successRedirectUrl: 'https://yourapp.com/success',
  failureRedirectUrl: 'https://yourapp.com/error',
  notifyUrl: 'https://yourapp.com/webhooks/unipile'
});

// Get account details
const account = await unipile.account.getById('account_id');

// Disconnect an account
await unipile.account.disconnect('account_id');
```

### User Operations

```javascript
// Get authenticated user's profile
const me = await unipile.users.getOwnProfile('account_id');

// Get a specific user
const user = await unipile.users.getOne('account_id', 'user_id');

// Search for users
const results = await unipile.users.search({
  account_id: 'acc_123',
  keywords: 'software engineer',
  limit: 50
});

// Send connection request (LinkedIn)
await unipile.users.sendConnectionRequest({
  account_id: 'acc_123',
  user_id: 'user_456',
  message: 'Would love to connect!'
});
```

### Messaging

```javascript
// Send to new conversation
await unipile.messaging.send({
  account_id: 'acc_123',
  user_id: 'user_456',
  text: 'Hello!'
});

// Send to existing chat
await unipile.messaging.sendMessage({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  text: 'Follow-up message'
});

// Get messages from a chat
const messages = await unipile.messaging.getMessages({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  limit: 50
});

// Get all chats
const chats = await unipile.messaging.getChats({
  account_id: 'acc_123',
  limit: 50
});

// Send with attachments
await unipile.messaging.sendMessageWithAttachment({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  text: 'Check this file',
  attachments: [{
    filename: 'document.pdf',
    buffer: fileBuffer,
    mimetype: 'application/pdf'
  }]
});
```

### LinkedIn Operations

```javascript
// Search LinkedIn
const results = await unipile.linkedin.search({
  account_id: 'acc_123',
  api: 'classic',
  category: 'people',
  keywords: 'CEO',
  limit: 25
});

// Search 1st degree connections
const connections = await unipile.connections.search({
  account_id: 'acc_123',
  keywords: 'developer',
  limit: 100
});
```

## Creating Custom Providers

You can extend `BaseProvider` to create custom providers:

```javascript
const { BaseProvider } = require('@relay/core');

class MyProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'myprovider';
  }

  isInitialized() {
    return !!this.config.apiKey;
  }

  getError() {
    return this.config.apiKey ? null : 'API key required';
  }
}
```
