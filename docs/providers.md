# Providers

Relay supports multiple messaging providers through a unified interface.

## Available Providers

| Provider | Status | Channels |
|----------|--------|----------|
| Unipile | Stable | LinkedIn, WhatsApp, Instagram, Telegram, Messenger, Email |
| Twilio | Coming Soon | SMS, WhatsApp, Voice |

## Unipile Provider

### Configuration

```javascript
const { UnipileProvider } = require('@guilhermegoulart1/relay-core');

const provider = new UnipileProvider({
  dsn: 'api1.unipile.com:13111',     // Your Unipile DSN
  accessToken: 'your-access-token',   // API access token
  timeout: 15000                      // Optional: request timeout in ms
});

// Check initialization
if (!provider.isInitialized()) {
  console.error('Error:', provider.getError());
}
```

### Available Managers

The provider exposes the following managers:

| Manager | Access | Description |
|---------|--------|-------------|
| `account` | `provider.account` | Account connection and management |
| `users` | `provider.users` | User profiles and search |
| `connections` | `provider.connections` | 1st degree connections (network) |
| `linkedin` | `provider.linkedin` | LinkedIn-specific features |
| `searchParams` | `provider.searchParams` | Search autocomplete parameters |
| `messaging` | `provider.messaging` | Messages and chats |
| `webhooks` | `provider.webhooks` | Webhook management |

---

## Account Management

```javascript
// Generate OAuth link for connecting accounts
const authLink = await provider.account.getHostedAuthLink({
  providers: ['LINKEDIN', 'WHATSAPP'],
  successRedirectUrl: 'https://yourapp.com/success',
  failureRedirectUrl: 'https://yourapp.com/error',
  notifyUrl: 'https://yourapp.com/webhooks/unipile'
});
console.log('Auth URL:', authLink.url);

// Connect LinkedIn directly with credentials
const account = await provider.account.connectLinkedin({
  username: 'user@email.com',
  password: 'password'
});

// Get account details
const account = await provider.account.getById('account_id');

// Disconnect an account
await provider.account.disconnect('account_id');
```

---

## User Operations

```javascript
// Get authenticated user's profile
const me = await provider.users.getOwnProfile('account_id');

// Get a specific user
const user = await provider.users.getOne('account_id', 'user_id');

// Get full LinkedIn profile (experiences, education, skills)
const fullProfile = await provider.users.getFullProfile('account_id', 'user_id');

// Search for users
const results = await provider.users.search({
  account_id: 'acc_123',
  keywords: 'software engineer',
  limit: 50
});

// Send connection request (LinkedIn)
await provider.users.sendConnectionRequest({
  account_id: 'acc_123',
  user_id: 'user_456',
  message: 'Would love to connect!'  // Optional, max 300 chars
});
```

---

## Connections (1st Degree)

Search your LinkedIn network (1st degree connections):

```javascript
const connections = await provider.connections.search({
  account_id: 'account_id',
  keywords: 'developer',           // Optional
  job_title: ['CTO', 'CEO'],       // Optional, string or array
  industry: ['Technology'],        // Optional
  location: 'Brazil',              // Optional
  limit: 100,                      // Default: 100
  cursor: 'next_page_cursor'       // For pagination
});

console.log('Found:', connections.items.length);
console.log('Next page:', connections.cursor);
```

---

## LinkedIn Search (2nd/3rd Degree)

Advanced search for non-connections:

```javascript
const results = await provider.linkedin.search({
  account_id: 'account_id',
  api: 'classic',                  // 'classic' or 'sales_navigator'
  category: 'people',              // 'people', 'companies', 'jobs'
  keywords: 'marketing manager',
  job_title: ['Marketing Manager', 'CMO'],
  industry: ['Marketing and Advertising'],
  location: 'urn:li:geo:106057199',  // LinkedIn location URN
  company: ['urn:li:company:1234'],
  network_distance: [2, 3],        // 2nd and 3rd degree
  limit: 50
});
```

---

## Search Parameters (Autocomplete)

Get autocomplete suggestions for building search forms:

```javascript
// Search locations
const locations = await provider.searchParams.locations({
  account_id: 'account_id',
  keywords: 'Sao Paulo',
  limit: 20
});
// Returns: [{ id, name, country, ... }]

// Search industries
const industries = await provider.searchParams.industries({
  account_id: 'account_id',
  keywords: 'Technology',
  limit: 20
});
// Returns: [{ id, name, ... }]

// Search job titles
const jobTitles = await provider.searchParams.jobTitles({
  account_id: 'account_id',
  keywords: 'Software',
  limit: 20
});
// Returns: [{ id, name, ... }]

// Search companies
const companies = await provider.searchParams.companies({
  account_id: 'account_id',
  keywords: 'Google',
  limit: 20
});
// Returns: [{ id, name, ... }]
```

---

## Messaging

```javascript
// Get all chats
const chats = await provider.messaging.getChats({
  account_id: 'acc_123',
  limit: 50,
  cursor: 'pagination_cursor'
});

// Get single chat
const chat = await provider.messaging.getChat({
  account_id: 'acc_123',
  chat_id: 'chat_id'
});

// Get messages from a chat
const messages = await provider.messaging.getMessages({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  limit: 50,
  before_id: 'message_id'  // For pagination (older messages)
});

// Send to new conversation
await provider.messaging.send({
  account_id: 'acc_123',
  user_id: 'user_456',
  text: 'Hello!'
});

// Send to existing chat
await provider.messaging.sendMessage({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  text: 'Follow-up message'
});

// Send with attachments
await provider.messaging.sendMessageWithAttachment({
  account_id: 'acc_123',
  chat_id: 'chat_789',
  text: 'Check this file',
  attachments: [{
    filename: 'document.pdf',
    buffer: fileBuffer,
    mimetype: 'application/pdf'
  }]
});

// Get attachment from message
const attachment = await provider.messaging.getAttachment({
  account_id: 'acc_123',
  message_id: 'msg_id',
  attachment_id: 'att_id'
});
// Returns: { data: Buffer, contentType, contentDisposition }

// Get attendee info
const attendee = await provider.messaging.getAttendeeById('attendee_id');

// Get attendee picture
const picture = await provider.messaging.getAttendeePicture('attendee_id');
// Returns: { data: Buffer, contentType } or null
```

---

## Webhooks

Programmatic webhook management:

```javascript
// List all webhooks
const webhooks = await provider.webhooks.list();

// Create webhook
const webhook = await provider.webhooks.create({
  request_url: 'https://your-api.com/webhooks/unipile',
  account_ids: ['account_1', 'account_2']  // Optional filter
});

// Find webhook by URL
const webhook = await provider.webhooks.findByUrl('https://your-api.com/webhooks/unipile');

// Ensure webhook exists (create if not)
const webhook = await provider.webhooks.ensureWebhook({
  request_url: 'https://your-api.com/webhooks/unipile'
});

// Add account to webhook filter
await provider.webhooks.addAccountToWebhook(
  'https://your-api.com/webhooks/unipile',
  'new_account_id',
  'LINKEDIN'  // or 'WHATSAPP', 'INSTAGRAM', etc.
);

// Remove account from webhook
await provider.webhooks.removeAccountFromWebhook(
  'https://your-api.com/webhooks/unipile',
  'account_id',
  'LINKEDIN'
);

// Get account IDs for webhook
const accountIds = await provider.webhooks.getAccountIds(
  'https://your-api.com/webhooks/unipile',
  'LINKEDIN'
);

// Delete webhook
await provider.webhooks.delete('webhook_id');
```

---

## Creating Custom Providers

You can extend `BaseProvider` to create custom providers:

```javascript
const { BaseProvider } = require('@guilhermegoulart1/relay-core');

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
