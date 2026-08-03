# @guilhermegoulart1/relay-core

Core package for Relay - unified messaging integrations for Node.js.

## Table of Contents

- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Quick Start](#quick-start)
- [Providers](#providers)
  - [UnipileProvider](#unipile-provider)
- [API Reference](#api-reference)
  - [Account Management](#account-management)
  - [Users](#users)
  - [Connections](#connections)
  - [LinkedIn Search](#linkedin-search)
  - [Search Parameters (Autocomplete)](#search-parameters-autocomplete)
  - [Messaging](#messaging)
  - [Webhooks](#webhooks)
- [Events](#events)
- [Queue Integration](#queue-integration)
- [Error Handling](#error-handling)
- [TypeScript](#typescript)
- [License](#license)

---

## Installation

```bash
npm install @guilhermegoulart1/relay-core
```

No registry setup or authentication needed — the package is published publicly
on [npmjs.com](https://www.npmjs.com/package/@guilhermegoulart1/relay-core).

### Requirements

- Node.js >= 18.0.0
- Unipile API credentials (DSN + Access Token)

---

## Environment Variables

Create a `.env` file in your project root:

```env
# Required - Unipile Configuration
UNIPILE_DSN=api1.unipile.com:13111
UNIPILE_ACCESS_TOKEN=your_access_token_here

# Alternative key name (either works)
UNIPILE_API_KEY=your_access_token_here

# Optional - For webhook handling
BACKEND_URL=https://your-api.com
FRONTEND_URL=https://your-app.com
```

### How to get Unipile credentials

1. Go to [Unipile Dashboard](https://app.unipile.com)
2. Create an account or sign in
3. Navigate to **Settings > API**
4. Copy your **DSN** and **Access Token**

---

## Quick Start

### Initialize Provider

```javascript
const { UnipileProvider } = require('@guilhermegoulart1/relay-core');

// Load environment variables
require('dotenv').config();

// Initialize provider
const provider = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Check initialization
if (!provider.isInitialized()) {
  console.error('Provider error:', provider.getError());
  process.exit(1);
}

console.log('Relay initialized successfully!');
```

### Send a Message

```javascript
// Send to existing chat
await provider.messaging.sendMessage({
  account_id: 'unipile_account_id',
  chat_id: 'chat_id',
  text: 'Hello from Relay!'
});

// Send to user (creates chat if needed)
await provider.messaging.send({
  account_id: 'unipile_account_id',
  user_id: 'linkedin_user_id',
  text: 'Hello!'
});
```

### Handle Webhooks

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
      console.log('New connection accepted:', event.userId);
      break;
  }

  res.status(200).send('OK');
});
```

---

## Providers

### Unipile Provider

Unipile provides unified access to multiple messaging platforms:

| Channel | Status | Features |
|---------|--------|----------|
| LinkedIn | Stable | Messages, Connections, Search, Invites |
| WhatsApp | Stable | Messages, Groups, Media |
| Instagram | Stable | DMs, Media |
| Telegram | Stable | Messages, Groups |
| Messenger | Stable | Messages |
| Email | Stable | IMAP/SMTP |

### Meta WhatsApp Cloud API Provider (v1.10.0+)

Official Meta Graph API integration. Stateless, single global endpoint
(`https://graph.facebook.com/{apiVersion}`), per-call credentials. Multi-tenant
apps load credentials per tenant from their DB and pass them to each call.

```javascript
const { MetaCloudApiProvider, parseCloudApiWebhook, validateCloudApiSignature } =
  require('@guilhermegoulart1/relay-core');

const meta = new MetaCloudApiProvider({
  apiVersion: 'v22.0',
  appSecret: process.env.META_APP_SECRET
});

// Send template (works any time)
await meta.messaging.sendTemplate({
  accessToken: creds.accessToken,
  phoneNumberId: creds.phoneNumberId,
  to: '5511999999999',
  templateName: 'lembrete_renovacao',
  language: 'pt_BR',
  components: [
    { type: 'body', parameters: [{ type: 'text', text: 'Joana' }] }
  ]
});

// Send free-form text (only inside the 24h customer-service window)
await meta.messaging.sendText({
  accessToken: creds.accessToken,
  phoneNumberId: creds.phoneNumberId,
  to: '5511999999999',
  body: 'Posso ajudar com mais alguma coisa?'
});

// Templates CRUD (auto-paginates Meta's cursor-based responses)
const all = await meta.templates.listAll({
  accessToken: creds.accessToken,
  businessAccountId: creds.businessAccountId
});

// Verify credentials work end-to-end (great for setup screens)
const info = await meta.account.verifyConnection({
  accessToken: creds.accessToken,
  phoneNumberId: creds.phoneNumberId
});
// => { ok: true, displayPhoneNumber, verifiedName, qualityRating, tier }
```

Webhooks (HMAC-SHA256 validated against the Meta App Secret) parse into
`NormalizedEvent[]` — one POST often batches multiple events:

```javascript
app.use('/webhooks/meta', express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

app.post('/webhooks/meta', (req, res) => {
  if (!validateCloudApiSignature(req.rawBody, req.headers['x-hub-signature-256'], appSecret)) {
    return res.sendStatus(401);
  }
  for (const ev of parseCloudApiWebhook(req.body)) emitter.emit(ev);
  res.sendStatus(200);
});
```

Two new EventTypes ship with this provider:
- `MESSAGE_FAILED` — `statuses[].status === 'failed'` and change-level errors
- `TEMPLATE_STATUS_CHANGED` — `message_template_status_update` (apps that listen
  react to template approval/rejection without polling)

Plus opt-in helpers: `effectiveDailyLimit(tier)`, `stableVariant(key)`,
`isInWindow(lastInboundAt)`. See [docs/providers.md](../../docs/providers.md)
for the full reference.

### Webchat Provider (v1.9.0+)

First-party embeddable chat channel. Unlike Unipile/Uazapi, webchat is **the
consuming app's own server**, not a wrapper around a third-party API. The
provider ships:

- `createWebchatHandler({ storage, realtime, emitter })` — Express factory
  mounting the 5 public routes (`/config`, `/session`, `/message`, `/identify`,
  `/history`) with dynamic CORS, rate limiting, and ownership checks
- `WebchatStorageAdapter` — abstract contract; apps implement against their
  own DB
- `WebchatRealtimeAdapter` — abstract contract for realtime fan-out
- `SSERealtimeAdapter` — zero-dep default (Server-Sent Events, single-process)
- `InMemoryWebchatStorage` — zero-dep default storage for examples/POCs
- `WebchatProvider.messaging.sendMessage(...)` for agent/AI → visitor

Plus the companion package `@guilhermegoulart1/relay-webchat-widget` with the
embeddable widget itself.

```javascript
const {
  createWebchatHandler, InMemoryWebchatStorage, SSERealtimeAdapter,
  MessagingEventEmitter, EventTypes
} = require('@guilhermegoulart1/relay-core');

const storage = new InMemoryWebchatStorage();
storage.seedChannel({ widgetKey: 'demo', accountId: 'acc-1' });
const realtime = new SSERealtimeAdapter();
const emitter = new MessagingEventEmitter();

emitter.on(EventTypes.MESSAGE_RECEIVED, (e) => {
  if (e.providerType === 'WEBCHAT') console.log('visitor:', e.content);
});

app.use('/api/public/webchat', createWebchatHandler({ storage, realtime, emitter }));
```

Visitor messages emit `NormalizedEvent.MESSAGE_RECEIVED` on the same emitter
as Unipile and Uazapi — so a single `emitter.on(MESSAGE_RECEIVED, ...)`
handler (filtered by `event.providerType`) can serve all 3 channels.

See [docs/providers.md](../../docs/providers.md) for the full reference.

### Uazapi Provider (v1.8.0+)

[Uazapi](https://docs.uazapi.com/) is a Brazilian WhatsApp API. The Uazapi
provider supports a **cluster of subscriptions** with heterogeneous capacities
and pluggable selection strategies, so you can spread WhatsApp instances
across multiple Uazapi servers automatically.

```javascript
const { UazapiProvider, parseWebhook } = require('@guilhermegoulart1/relay-core');

// Single-server (simplest)
const uazapi = new UazapiProvider({
  baseUrl: process.env.UAZ_BASE_URL,        // e.g. 'https://free.uazapi.com'
  adminToken: process.env.UAZ_ADMIN_TOKEN
});

// Or multi-server with heterogeneous capacities
const uazapi = new UazapiProvider({
  servers: [
    { id: 'plano-pequeno', baseUrl: 'https://srv1.uazapi.com', adminToken: '...', capacity: 2 },
    { id: 'plano-medio',   baseUrl: 'https://srv2.uazapi.com', adminToken: '...', capacity: 4 },
    { id: 'plano-grande',  baseUrl: 'https://srv3.uazapi.com', adminToken: '...', capacity: 10 }
  ],
  selectionStrategy: 'weighted-round-robin',  // 2:4:10 distribution
  getServerLoad: async (serverId) => db.instances.count({ where: { server_id: serverId } })
});

// Provision a new instance + connect
const created = await uazapi.instance.create({ name: 'tenant-acme' });
// => { id, token, serverId, serverUrl, ... }  (persist these in your DB)

await uazapi.webhooks.set({
  token: created.token,
  serverId: created.serverId,
  url: `${process.env.PUBLIC_URL}/webhooks/uazapi`,
  events: ['messages', 'messages_update', 'connection']
});

const conn = await uazapi.instance.connect({
  token: created.token,
  serverId: created.serverId
});
// conn.instance.qrcode is a base64 PNG -> show to the user

// Send a message later
await uazapi.messaging.sendText({
  token: created.token,
  serverId: created.serverId,
  number: '5511999999999',
  text: 'Olá!'
});
```

Selection strategies: `pinned`, `round-robin`, `weighted-round-robin`,
`least-loaded`, `fill-first`, or a custom function. The pool can be
reconfigured at runtime — `pool.add()`, `pool.update(id, patch)`,
`pool.disable(id)`, `pool.enable(id)`, `pool.remove(id)`, `pool.stats()`.

See [docs/providers.md](../../docs/providers.md) for the full reference.

---

## API Reference

### Account Management

```javascript
// Generate OAuth link for user authentication
const authLink = await provider.account.getHostedAuthLink({
  providers: ['LINKEDIN', 'WHATSAPP'],
  successRedirectUrl: 'https://your-app.com/success',
  failureRedirectUrl: 'https://your-app.com/error',
  notifyUrl: 'https://your-api.com/webhooks/account'
});
console.log('Auth URL:', authLink.url);

// Connect LinkedIn with credentials (direct)
const account = await provider.account.connectLinkedin({
  username: 'user@email.com',
  password: 'password'
});

// Get account details
const account = await provider.account.getById('account_id');

// Disconnect account
await provider.account.disconnect('account_id');
```

### Users

```javascript
// Get own profile
const myProfile = await provider.users.getOwnProfile('account_id');

// Get user by ID
const user = await provider.users.getOne('account_id', 'user_id');

// Get full profile with all LinkedIn sections
const fullProfile = await provider.users.getFullProfile('account_id', 'user_id');
// Returns: experiences, education, skills, certifications, etc.

// Search users
const results = await provider.users.search({
  account_id: 'account_id',
  keywords: 'software engineer',
  limit: 25
});

// Send connection request (invite)
await provider.users.sendConnectionRequest({
  account_id: 'account_id',
  user_id: 'linkedin_user_id',
  message: 'Hi! I would like to connect.' // Optional, max 300 chars
});
```

### Connections

Search 1st degree connections (your network):

```javascript
const connections = await provider.connections.search({
  account_id: 'account_id',
  keywords: 'developer',           // Optional
  job_title: ['CTO', 'CEO'],       // Optional, can be string or array
  industry: ['Technology'],        // Optional
  location: 'Brazil',              // Optional
  limit: 100,                      // Default: 100
  cursor: 'next_page_cursor'       // For pagination
});

console.log('Connections found:', connections.items.length);
console.log('Next page:', connections.cursor);
```

### LinkedIn Search

Advanced LinkedIn search (2nd/3rd degree):

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

### Search Parameters (Autocomplete)

Get autocomplete suggestions for search forms:

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

### Messaging

```javascript
// Get all chats
const chats = await provider.messaging.getChats({
  account_id: 'account_id',
  limit: 50,
  cursor: 'pagination_cursor'
});

// Get single chat
const chat = await provider.messaging.getChat({
  account_id: 'account_id',
  chat_id: 'chat_id'
});

// Get messages from chat
const messages = await provider.messaging.getMessages({
  account_id: 'account_id',
  chat_id: 'chat_id',
  limit: 50,
  before_id: 'message_id'  // For pagination (older messages)
});

// Send text message
await provider.messaging.sendMessage({
  account_id: 'account_id',
  chat_id: 'chat_id',
  text: 'Hello!'
});

// Send message with attachment
await provider.messaging.sendMessageWithAttachment({
  account_id: 'account_id',
  chat_id: 'chat_id',
  text: 'Check this file',
  attachments: [{
    filename: 'document.pdf',
    buffer: fileBuffer,
    mimetype: 'application/pdf'
  }]
});

// Get attachment from message
const attachment = await provider.messaging.getAttachment({
  account_id: 'account_id',
  message_id: 'message_id',
  attachment_id: 'attachment_id'
});
// Returns: { data: Buffer, contentType, contentDisposition }

// Get attendee (participant) info
const attendee = await provider.messaging.getAttendeeById('attendee_id');

// Get attendee profile picture
const picture = await provider.messaging.getAttendeePicture('attendee_id');
// Returns: { data: Buffer, contentType } or null

// Get own profile from chats (WhatsApp, Instagram)
const ownProfile = await provider.messaging.getOwnProfileFromChats('account_id');
```

### Webhooks

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

## Events

Normalized event types across all providers:

```javascript
const { EventTypes, parseWebhook } = require('@guilhermegoulart1/relay-core');

// Available event types
EventTypes.MESSAGE_RECEIVED     // Incoming message
EventTypes.MESSAGE_SENT         // Outgoing message (sent by you)
EventTypes.MESSAGE_DELIVERED    // Message was delivered
EventTypes.MESSAGE_READ         // Message was read
EventTypes.MESSAGE_EDITED       // Message was edited
EventTypes.MESSAGE_DELETED      // Message was deleted
EventTypes.MESSAGE_REACTION     // Reaction added to message
EventTypes.RELATION_CREATED     // New connection/relation accepted
EventTypes.RELATION_REMOVED     // Connection removed
EventTypes.ACCOUNT_CONNECTED    // Account connected to Unipile
EventTypes.ACCOUNT_DISCONNECTED // Account disconnected
EventTypes.ACCOUNT_STATUS       // Account status changed

// Parse incoming webhook
const event = parseWebhook('unipile', req.body);

// Event structure
{
  type: 'message_received',
  provider: 'unipile',
  accountId: 'account_id',
  chatId: 'chat_id',
  messageId: 'message_id',
  senderId: 'sender_id',
  content: 'Message text',
  timestamp: Date,
  raw: { /* original payload */ }
}
```

---

## Queue Integration

Optional Bull queue integration for async webhook processing:

```javascript
const { createWebhookQueue, addWebhookJob } = require('@guilhermegoulart1/relay-core/queue');
const Redis = require('ioredis');

// Create queue
const redis = new Redis(process.env.REDIS_URL);
const queue = createWebhookQueue(redis, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

// Add job to queue
await addWebhookJob(queue, event, {
  priority: 1,
  delay: 0
});

// Process jobs
queue.process('webhook', 5, async (job) => {
  const { event } = job.data;

  // Handle event...
  console.log('Processing:', event.type);
});
```

---

## Error Handling

```javascript
try {
  await provider.messaging.sendMessage({
    account_id: 'account_id',
    chat_id: 'chat_id',
    text: 'Hello!'
  });
} catch (error) {
  if (error.response) {
    // Unipile API error
    console.error('API Error:', error.response.status);
    console.error('Message:', error.response.data);
  } else {
    // Network or other error
    console.error('Error:', error.message);
  }
}
```

Common error codes:

| Code | Meaning |
|------|---------|
| 400 | Bad request (invalid parameters) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (no permission) |
| 404 | Not found (account/chat/message) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## TypeScript

Full TypeScript support included:

```typescript
import { UnipileProvider, EventTypes, parseWebhook } from '@guilhermegoulart1/relay-core';
import type { NormalizedEvent, WebhookPayload } from '@guilhermegoulart1/relay-core';

const provider = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN!,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN!
});

const handleWebhook = (payload: WebhookPayload): NormalizedEvent => {
  return parseWebhook('unipile', payload);
};
```

---

## Complete Example

```javascript
const express = require('express');
const { UnipileProvider, parseWebhook, EventTypes } = require('@guilhermegoulart1/relay-core');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize provider
const provider = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

if (!provider.isInitialized()) {
  console.error('Failed to initialize:', provider.getError());
  process.exit(1);
}

// Webhook endpoint
app.post('/webhooks/unipile', async (req, res) => {
  try {
    const event = parseWebhook('unipile', req.body);

    if (event.type === EventTypes.MESSAGE_RECEIVED) {
      console.log(`New message from ${event.senderId}: ${event.content}`);

      // Auto-reply example
      await provider.messaging.sendMessage({
        account_id: event.accountId,
        chat_id: event.chatId,
        text: 'Thanks for your message! We will respond shortly.'
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## License

MIT - Guilherme Goulart
