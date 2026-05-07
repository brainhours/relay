# Providers

Relay supports multiple messaging providers through a unified interface.

## Available Providers

| Provider | Status | Channels |
|----------|--------|----------|
| Unipile | Stable | LinkedIn, WhatsApp, Instagram, Telegram, Messenger, Email |
| Uazapi | Stable (v1.8.0+) | WhatsApp (Brazilian API, multi-instance) |
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

## Uazapi Provider

[Uazapi](https://docs.uazapi.com/) is a Brazilian WhatsApp API. Each Uazapi
**subscription** is an independent server (with its own subdomain and
`adminToken`) that can host multiple WhatsApp instances. The provider models
this directly: it owns a **pool of servers** with heterogeneous capacities and
chooses which server hosts each new instance using a pluggable strategy.

The Relay stays stateless — your application persists, per tenant, the
`(serverId, instanceId, instanceToken)` returned by `instance.create()` and
passes them back on every subsequent call.

### Configuration

```javascript
const { UazapiProvider } = require('@guilhermegoulart1/relay-core');

// Single-server (simplest form)
const uazapi = new UazapiProvider({
  baseUrl: 'https://free.uazapi.com',
  adminToken: process.env.UAZ_ADMIN_TOKEN,
  timeout: 15000
});

// Multi-server cluster
const uazapi = new UazapiProvider({
  servers: [
    { id: 'plano-pequeno', baseUrl: 'https://srv1.uazapi.com', adminToken: '...', capacity: 2 },
    { id: 'plano-medio',   baseUrl: 'https://srv2.uazapi.com', adminToken: '...', capacity: 4 },
    { id: 'plano-grande',  baseUrl: 'https://srv3.uazapi.com', adminToken: '...', capacity: 10 }
  ],
  selectionStrategy: 'weighted-round-robin',
  getServerLoad: async (serverId) =>
    db.instances.count({ where: { server_id: serverId, deleted: false } })
});
```

#### Server fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | — | **Required.** Stable identifier you choose. |
| `baseUrl` | string | — | **Required.** e.g. `https://srv1.uazapi.com`. |
| `adminToken` | string | — | Required for admin endpoints (`instance.create`, `instance.listAll`). |
| `capacity` | number | `Infinity` | Max instances. Used by load-aware strategies and as default `weight`. |
| `weight` | number | `capacity` | Weight for `weighted-round-robin`. |
| `enabled` | boolean | `true` | When `false`, excluded from `pickForCreate` but still serves existing instances via `resolve()`. |
| `tags` | string[] | `[]` | Free-form tags for custom strategies. |

#### Selection strategies

| Strategy | When to use | Behavior |
|----------|-------------|----------|
| `pinned` | One server (default for single-server pools) | Always returns the first enabled server. |
| `round-robin` | Even distribution | Cycles through enabled, non-full servers. |
| `weighted-round-robin` | Heterogeneous capacities | Smooth WRR (Nginx-style). A server with `weight=10` receives 5× more than `weight=2`. |
| `least-loaded` | Dynamic balancing | Requires `getServerLoad`. Picks the lowest `load/capacity` ratio. |
| `fill-first` | Fill cheap servers first | Fills one server up to capacity before moving on. Requires `getServerLoad` for proper effect. |
| `function` | Custom logic | `(eligibleServers, ctx) => server`. `ctx` includes `currentLoads` when `getServerLoad` is available, plus `name` from `instance.create({ name })`. |

The default strategy is `pinned` for single-server pools and `round-robin`
for multi-server pools. Servers with `load >= capacity` (when `getServerLoad`
is provided) and `enabled: false` servers are filtered out automatically.

You can also override the strategy per-call:

```javascript
await uazapi.instance.create({
  name: 'tenant-acme',
  serverId: 'plano-grande'              // force a specific server
});

await uazapi.instance.create({
  name: 'tenant-acme',
  strategy: 'least-loaded'              // override default for this call
});
```

#### Runtime reconfiguration

The pool can be modified without restarting:

```javascript
uazapi.pool.add({ id: 'srv4', baseUrl: '...', adminToken: '...', capacity: 5 });
uazapi.pool.update('plano-pequeno', { capacity: 5 });   // upgraded plan
uazapi.pool.disable('plano-medio');                      // temporary maintenance
uazapi.pool.enable('plano-medio');
uazapi.pool.remove('plano-pequeno');                     // subscription cancelled
await uazapi.pool.stats();                               // [{ id, capacity, load, enabled, ... }]
```

`disable()` removes a server from `pickForCreate` but keeps it usable for
operations on existing instances (so a maintenance window doesn't break
already-provisioned tenants).

### Authentication

| Header | Used for | Source |
|--------|----------|--------|
| `admintoken` | Admin endpoints (`/instance/create`, `/instance/all`) | `server.adminToken` |
| `token` | All instance-scoped endpoints | Per-call `token` parameter (the instance token returned by `instance.create()`) |

A single `UazapiProvider` instance handles **all** servers and **all**
instances. You don't need to instantiate one provider per tenant.

### Available managers

| Manager | Access | Description |
|---------|--------|-------------|
| `instance` | `uazapi.instance` | Create / connect (QR or pairing code) / status / disconnect / delete / list / set presence |
| `messaging` | `uazapi.messaging` | sendText, sendMedia, sendContact, sendLocation, sendMenu, react, edit, delete, markRead, sendPresence, pin, download |
| `chats` | `uazapi.chats` | find (with `wa_*` / `lead_*` filters), archive, mute, pin, read, details, check, delete |
| `contacts` | `uazapi.contacts` | list, listPaginated, add, remove |
| `messages` | `uazapi.messages` | find, download, historySync |
| `groups` | `uazapi.groups` | create, info, list, listPaginated, leave, updateParticipants, updateName, updateDescription |
| `profile` | `uazapi.profile` | updateName, updateImage |
| `webhooks` | `uazapi.webhooks` | get, set, addOne, update, delete, ensure (idempotent), getErrors |

### Instance lifecycle

```javascript
// 1. Create instance (the pool picks a server)
const created = await uazapi.instance.create({ name: 'tenant-acme' });
// => { id, token, serverId, serverUrl, ...rest }

// 2. Configure webhook (excludeMessages: ['wasSentByApi'] is the default)
await uazapi.webhooks.set({
  token: created.token, serverId: created.serverId,
  url: 'https://app.com/webhooks/uazapi',
  events: ['messages', 'messages_update', 'connection']
});

// 3. Connect (QR by default, or pass `phone` for a pairing code)
const conn = await uazapi.instance.connect({
  token: created.token, serverId: created.serverId
});
// conn.instance.qrcode is a base64 PNG

// 4. Check status
const status = await uazapi.instance.getStatus({
  token: created.token, serverId: created.serverId
});

// 5. Send a message
await uazapi.messaging.sendText({
  token: created.token, serverId: created.serverId,
  number: '5511999999999', text: 'Olá!'
});
```

### Webhook payload

Uazapi POSTs `{ event, instance, data }` to your webhook URL. Use
`parseWebhook('uazapi', body)` to normalize:

```javascript
const { parseWebhook, EventTypes } = require('@guilhermegoulart1/relay-core');

app.post('/webhooks/uazapi', (req, res) => {
  const event = parseWebhook('uazapi', req.body);
  // {
  //   type:        EventTypes.MESSAGE_RECEIVED | MESSAGE_SENT | MESSAGE_READ | ...,
  //   provider:    'uazapi',
  //   providerType: 'WHATSAPP',
  //   accountId:   '<instance-id>',
  //   chatId, messageId, senderId, senderName, content, timestamp, attachments,
  //   metadata: {
  //     originalEvent, isGroup, fromMe, messageType, status, wasSentByApi,
  //     quoted, reaction, edited, senderShort, source,
  //     connected, lastDisconnect, lastDisconnectReason
  //   }
  // }
  res.json({ ok: true });
});
```

#### Event channel → normalized type

| Uazapi `event` | Refined by | Normalized `type` |
|---|---|---|
| `messages` | `data.fromMe` | `MESSAGE_SENT` (true) / `MESSAGE_RECEIVED` (false) |
| `messages_update` | `data.reaction` | `MESSAGE_REACTION` |
| `messages_update` | `data.edited` | `MESSAGE_EDITED` |
| `messages_update` | `data.deleted` or `status === 'Deleted'` | `MESSAGE_DELETED` |
| `messages_update` | `data.status === 'Read'` | `MESSAGE_READ` |
| `messages_update` | `data.status === 'Delivered'` | `MESSAGE_DELIVERED` |
| `connection` | `data.connected === true` | `ACCOUNT_CONNECTED` |
| `connection` | `data.connected === false` | `ACCOUNT_DISCONNECTED` |
| `connection` | otherwise | `ACCOUNT_STATUS_CHANGED` |
| `newsletter_messages` | — | `MESSAGE_RECEIVED` |
| `contacts` | — | `RELATION_CREATED` (closest match) |
| Others (`presence`, `groups`, `chats`, `call`, ...) | — | `UNKNOWN` |

> **Webhook signature.** Uazapi v2.1.0 does not document an HMAC signature
> header. The recommended hardening is a per-instance secret embedded in
> the webhook URL (e.g. `https://app.com/webhooks/uazapi?secret=<random>`),
> verified in your route handler. `validateWebhookSignature('uazapi', ...)`
> always returns `true` until upstream adds a scheme.

### Multi-instance loop prevention

Uazapi's `excludeMessages: ['wasSentByApi']` filter is applied automatically
by `webhooks.set()`. This prevents your own outbound API messages from
re-entering as inbound webhooks. To opt out, pass an explicit empty array:

```javascript
await uazapi.webhooks.set({
  token, serverId, url,
  events: ['messages', 'messages_update'],
  excludeMessages: []           // get every message back
});
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
