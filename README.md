# Relay

<p align="center">
  <strong>Unified messaging integrations for Node.js applications</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#packages">Packages</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#supported-channels">Channels</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## Features

- **Multi-provider support** - Unipile (LinkedIn / WhatsApp / Email / …), Uazapi (WhatsApp BR), Meta Cloud API (official WhatsApp), Twilio (SMS / MMS / WhatsApp), Zernio (social publishing + inbox + ads across 15 channels), and first-party Webchat
- **Normalized events** - Consistent event format across all messaging providers
- **Webhook handling** - Built-in parsing, validation, and queue management
- **Channel agnostic** - LinkedIn, WhatsApp, Instagram, Telegram, SMS, Email
- **Production ready** - Battle-tested in high-volume B2B applications
- **TypeScript support** - Full type definitions included

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@guilhermegoulart1/relay-core](./packages/core) | 1.10.0 | Core messaging integrations (Unipile + Uazapi + Meta Cloud API + Webchat) |
| [@guilhermegoulart1/relay-webchat-widget](./packages/webchat-widget) | 1.0.0 | Embeddable webchat widget (vanilla JS, transport-pluggable) |

---

## Quick Start

### 1. Install

```bash
npm install @guilhermegoulart1/relay-core
```

No registry setup or authentication needed — the package is published publicly
on [npmjs.com](https://www.npmjs.com/package/@guilhermegoulart1/relay-core).

### 2. Configure Environment

```env
# .env
UNIPILE_DSN=api1.unipile.com:13111
UNIPILE_ACCESS_TOKEN=your_token_here
```

### 3. Initialize

```javascript
const { UnipileProvider } = require('@guilhermegoulart1/relay-core');
require('dotenv').config();

const provider = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Send a message
await provider.messaging.sendMessage({
  account_id: 'account_id',
  chat_id: 'chat_id',
  text: 'Hello from Relay!'
});
```

### 4. Handle Webhooks

```javascript
const { parseWebhook, EventTypes } = require('@guilhermegoulart1/relay-core');

app.post('/webhooks/unipile', (req, res) => {
  const event = parseWebhook('unipile', req.body);

  if (event.type === EventTypes.MESSAGE_RECEIVED) {
    console.log('New message:', event.content);
  }

  res.status(200).send('OK');
});
```

---

## Supported Channels

| Channel | Provider | Status |
|---------|----------|--------|
| LinkedIn | Unipile | Stable |
| WhatsApp | Unipile | Stable |
| WhatsApp (BR API) | Uazapi | Stable (v1.8.0+) |
| WhatsApp (Meta official) | Cloud API | Stable (v1.10.0+) |
| Webchat (your site) | Webchat | Stable (v1.9.0+) |
| Instagram | Unipile | Stable |
| Telegram | Unipile | Stable |
| Messenger | Unipile | Stable |
| Email | Unipile | Stable |
| SMS / MMS | Twilio | Stable (v1.18.0+) |
| WhatsApp (Twilio) | Twilio | Stable (v1.18.0+) |
| Social publishing (15 channels) | Zernio | Stable (v1.21.0+) |
| Social inbox / DMs (IG / FB / WhatsApp / Telegram / X / Reddit / Bluesky) | Zernio | Stable (v1.21.0+) |
| WhatsApp (Meta official, Embedded Signup) | Zernio | Stable (v1.21.0+) |
| Comments / reviews / ads | Zernio | Stable (v1.21.0+) |

### Meta Cloud API (official WhatsApp) quick start

```javascript
const express = require('express');
const {
  MetaCloudApiProvider,
  parseCloudApiWebhook,
  validateCloudApiSignature,
  MessagingEventEmitter,
  EventTypes
} = require('@guilhermegoulart1/relay-core');

const meta = new MetaCloudApiProvider({
  apiVersion: 'v22.0',
  appSecret: process.env.META_APP_SECRET   // for HMAC validation
});

const emitter = new MessagingEventEmitter();
emitter.on(EventTypes.MESSAGE_RECEIVED, (e) => {
  if (e.provider !== 'cloud-api') return;
  console.log(e.senderName, ':', e.content);
});
emitter.on(EventTypes.TEMPLATE_STATUS_CHANGED, (e) => {
  console.log('Template', e.metadata.templateName, '->', e.metadata.newStatus);
});

const app = express();

// Capture raw body for HMAC validation:
app.use('/webhooks/meta', express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

app.post('/webhooks/meta', (req, res) => {
  const ok = validateCloudApiSignature(
    req.rawBody, req.headers['x-hub-signature-256'], process.env.META_APP_SECRET
  );
  if (!ok) return res.sendStatus(401);

  // parseCloudApiWebhook returns ARRAY (Cloud API batches up to 100 events per POST)
  for (const event of parseCloudApiWebhook(req.body)) {
    emitter.emit(event);
  }
  res.sendStatus(200);
});

// Send a template (per-call credentials -> multi-tenant ready)
const creds = await db.loadCredsForTenant(tenantId);
await meta.messaging.sendTemplate({
  accessToken: creds.accessToken,
  phoneNumberId: creds.phoneNumberId,
  to: '5511999999999',
  templateName: 'hello_world',
  language: 'en_US',
  components: []
});
```

See [examples/cloud-api](./examples/cloud-api) for the full setup.

### Webchat (first-party embeddable chat) quick start

Zero external dependencies — works with just Express + Node:

```javascript
const express = require('express');
const {
  createWebchatHandler,
  InMemoryWebchatStorage,
  SSERealtimeAdapter,
  MessagingEventEmitter,
  EventTypes
} = require('@guilhermegoulart1/relay-core');

const storage = new InMemoryWebchatStorage();
storage.seedChannel({ widgetKey: 'demo', accountId: 'acc-1' });

const realtime = new SSERealtimeAdapter();
const emitter = new MessagingEventEmitter();

emitter.on(EventTypes.MESSAGE_RECEIVED, (event) => {
  if (event.providerType !== 'WEBCHAT') return;
  console.log(`visitor: ${event.content}`);
  // Same emitter handles Unipile + Uazapi too — filter by providerType.
});

const app = express();
app.use('/api/public/webchat', createWebchatHandler({ storage, realtime, emitter }));
app.listen(3000);
```

Then embed the widget on your customer's site:

```html
<script
  src="https://your-app.com/widget/dist/widget.js"
  data-widget-key="demo"
  data-api-url="https://your-app.com"
  defer
></script>
```

For production: write your own `WebchatStorageAdapter` against your DB (Postgres /
Mongo / etc.) and pick a realtime adapter (default SSE for single-process,
custom for Ably / Pusher / Redis / WebSocket). See
[examples/webchat](./examples/webchat) and
[examples/webchat-ably](./examples/webchat-ably).

### Uazapi (WhatsApp) quick start

```javascript
const { UazapiProvider, parseWebhook } = require('@guilhermegoulart1/relay-core');

// Multi-server cluster with heterogeneous capacities (or pass a single
// { baseUrl, adminToken } for a single server)
const uazapi = new UazapiProvider({
  servers: [
    { id: 'plano-pequeno', baseUrl: 'https://srv1.uazapi.com', adminToken: '...', capacity: 2 },
    { id: 'plano-grande',  baseUrl: 'https://srv2.uazapi.com', adminToken: '...', capacity: 10 }
  ],
  selectionStrategy: 'weighted-round-robin',
  getServerLoad: async (id) => db.instances.count({ where: { server_id: id } })
});

// Provision a new instance: pool picks a server respecting capacity
const created = await uazapi.instance.create({ name: 'tenant-acme' });
// Returns { id, token, serverId, serverUrl, ... } - persist these in your DB

// Webhooks
await uazapi.webhooks.set({
  token: created.token, serverId: created.serverId,
  url: 'https://app.com/webhooks/uazapi',
  events: ['messages', 'messages_update', 'connection']
});

app.post('/webhooks/uazapi', (req, res) => {
  const event = parseWebhook('uazapi', req.body);
  // event.provider === 'uazapi', event.providerType === 'WHATSAPP'
  // event.type ∈ MESSAGE_RECEIVED|MESSAGE_SENT|MESSAGE_READ|... (refined per data)
  res.json({ ok: true });
});
```

### Twilio (SMS / MMS / WhatsApp) quick start

```javascript
const express = require('express');
const {
  TwilioProvider,
  parseTwilioWebhook,
  validateTwilioSignature,
  emptyMessagingResponse,
  MessagingEventEmitter,
  EventTypes
} = require('@guilhermegoulart1/relay-core');

const twilio = new TwilioProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN     // also signs inbound webhooks
});

const emitter = new MessagingEventEmitter();
emitter.on(EventTypes.MESSAGE_RECEIVED, (e) => {
  if (e.provider !== 'twilio') return;
  console.log(`${e.metadata.channel} ${e.senderName || e.senderId}: ${e.content}`);
});

const app = express();

// Twilio webhooks are application/x-www-form-urlencoded (NOT JSON)
app.post('/webhooks/twilio',
  express.urlencoded({ extended: false }),
  (req, res) => {
    const url = `https://${req.headers.host}${req.originalUrl}`;
    const ok = validateTwilioSignature(
      url, req.body, req.headers['x-twilio-signature'], process.env.TWILIO_AUTH_TOKEN
    );
    if (!ok) return res.sendStatus(403);

    emitter.emit(parseTwilioWebhook(req.body));
    res.type('text/xml').send(emptyMessagingResponse());
  });

// Send an SMS
await twilio.messaging.sendSms({
  to: '+5511999999999',
  from: '+12025550123',
  body: 'Hello from Relay!'
});

// Send a WhatsApp message (whatsapp: prefix added for you)
await twilio.messaging.sendWhatsApp({
  to: '+5511999999999',
  from: '+14155238886',
  body: 'Olá!'
});
```

See [examples/twilio](./examples/twilio) for the full setup.

### Zernio (social publishing + inbox + ads) quick start

Zernio is a **single-key** API covering 15 channels (Twitter/X, Instagram,
Facebook, LinkedIn, TikTok, YouTube, Pinterest, Reddit, Bluesky, Threads,
Google Business, Telegram, Snapchat, WhatsApp, Discord). Unlike the messaging
providers, the tenant boundary is the `profileId` / `accountId` you pass per
call — not the credential.

```javascript
const express = require('express');
const {
  ZernioProvider,
  parseZernioWebhook,
  validateZernioSignature,
  MessagingEventEmitter,
  EventTypes
} = require('@guilhermegoulart1/relay-core');

const zernio = new ZernioProvider({
  apiKey: process.env.ZERNIO_API_KEY,
  webhookSecret: process.env.ZERNIO_WEBHOOK_SECRET
});

// Publish to LinkedIn + Instagram at once
await zernio.posts.create({
  content: 'New drop 🚀',
  publishNow: true,
  platforms: [
    { platform: 'linkedin', accountId: liAccountId },
    { platform: 'instagram', accountId: igAccountId }
  ]
});

// Connect WhatsApp with Meta Embedded Signup (no manual BM token):
const { authUrl } = await zernio.connect.getConnectUrl({
  platform: 'whatsapp',
  profileId,
  redirectUrl: 'https://app.example.com/callback'
});
// → redirect the client to authUrl; Meta hosts the WABA + number picker.

// Social inbox: reply to a DM
await zernio.messaging.send({
  conversationId,
  accountId: igAccountId,
  message: 'Thanks for reaching out!'
});

// Webhook intake (JSON; capture the raw body for signature verification)
const emitter = new MessagingEventEmitter();
app.use('/webhooks/zernio', express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.post('/webhooks/zernio', (req, res) => {
  if (!validateZernioSignature(req.rawBody, req.headers['x-zernio-signature'], process.env.ZERNIO_WEBHOOK_SECRET)) {
    return res.sendStatus(401);
  }
  const event = parseZernioWebhook(req.body);
  if (event && event.type === EventTypes.MESSAGE_RECEIVED) emitter.emit(event);
  res.sendStatus(200);
});
```

Managers on the provider instance: `posts`, `media`, `accounts`, `connect`,
`messaging`, `comments`, `reviews`, `whatsapp`, `analytics`, `crm`, `ads`,
`engagement`, `webhooks`.

---

## API Capabilities

### Account Management
- OAuth hosted authentication
- Direct credential connection
- Account status monitoring
- Multi-account support

### Messaging
- Send/receive messages
- File attachments
- Message reactions
- Read receipts
- Chat history

### LinkedIn Specific
- Profile search (1st, 2nd, 3rd degree)
- Connection requests (invites)
- Full profile data (experiences, education, skills)
- Search parameters autocomplete (locations, industries, job titles, companies)

### Webhooks
- Real-time event notifications
- Normalized event format
- Programmatic webhook management
- Account filtering

---

## Documentation

See the [packages/core README](./packages/core/README.md) for complete API documentation.

### Key Topics

- [Installation](./packages/core/README.md#installation)
- [Environment Variables](./packages/core/README.md#environment-variables)
- [Account Management](./packages/core/README.md#account-management)
- [Messaging](./packages/core/README.md#messaging)
- [LinkedIn Search](./packages/core/README.md#linkedin-search)
- [Search Parameters](./packages/core/README.md#search-parameters-autocomplete)
- [Webhooks](./packages/core/README.md#webhooks)
- [Events](./packages/core/README.md#events)
- [Error Handling](./packages/core/README.md#error-handling)

---

## Examples

Check out the [examples](./examples) directory:

- [Express Webhook Handler](./examples/express-webhook) - Basic webhook processing

---

## Changelog

See [CHANGELOG.md](./packages/core/CHANGELOG.md) for version history.

### Recent Updates

**v1.2.0** (2024-12-30)
- Added `searchParams` manager for LinkedIn autocomplete (locations, industries, job titles, companies)

**v1.1.0** (2024-12-29)
- Added `webhooks` manager for programmatic webhook management

**v1.0.0** (2024-12-29)
- Initial release with Unipile provider

---

## Getting Unipile Credentials

1. Go to [Unipile Dashboard](https://app.unipile.com)
2. Create an account or sign in
3. Navigate to **Settings > API**
4. Copy your **DSN** and **Access Token**

---

## Requirements

- Node.js >= 18.0.0
- npm or yarn
- Unipile account (for Unipile provider)

---

## License

[MIT](./LICENSE) - Guilherme Goulart
