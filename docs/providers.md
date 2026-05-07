# Providers

Relay supports multiple messaging providers through a unified interface.

## Available Providers

| Provider | Status | Channels |
|----------|--------|----------|
| Unipile | Stable | LinkedIn, WhatsApp, Instagram, Telegram, Messenger, Email |
| Uazapi | Stable (v1.8.0+) | WhatsApp (Brazilian API, multi-instance) |
| Cloud API | Stable (v1.10.0+) | WhatsApp (official Meta Cloud API) |
| Webchat | Stable (v1.9.0+) | First-party embeddable chat on your customer's site |
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

## Meta WhatsApp Cloud API Provider

The official Meta Graph API integration. Single global endpoint
(`https://graph.facebook.com/{apiVersion}`), no servers to manage, multi-tenant
via per-call credentials.

### Configuration

```javascript
const { MetaCloudApiProvider } = require('@guilhermegoulart1/relay-core');

const meta = new MetaCloudApiProvider({
  apiVersion: 'v22.0',                       // optional, default 'v22.0'
  appSecret: process.env.META_APP_SECRET,    // required for HMAC validation
  timeout: 15000                              // optional axios timeout
});
```

The provider holds NO tenant state — each method call takes the credentials
needed for that operation:

| Operation type | Credentials |
|---|---|
| `messaging.*`, `media.upload/download` | `accessToken`, `phoneNumberId` |
| `templates.*`, `account.listPhoneNumbers/getBusinessAccount` | `accessToken`, `businessAccountId` |
| `account.getPhoneNumber/verifyConnection/register` | `accessToken`, `phoneNumberId` |

Apps load these per tenant from their DB and pass them in.

### Available managers

| Manager | Access | Methods |
|---------|--------|---------|
| `messaging` | `meta.messaging` | sendTemplate, sendText, sendInteractive, sendMedia, sendLocation, sendContacts, sendReaction, markRead |
| `templates` | `meta.templates` | list, listAll (auto-paginates), get, create, delete, edit |
| `media` | `meta.media` | upload, download, getInfo, delete |
| `account` | `meta.account` | getPhoneNumber, listPhoneNumbers, getBusinessAccount, register, deregister, verifyConnection |

### Sending — examples

```javascript
// Template (allowed any time, including outside the 24h window)
await meta.messaging.sendTemplate({
  accessToken, phoneNumberId,
  to: '5511999999999',
  templateName: 'lembrete_renovacao',
  language: 'pt_BR',
  components: [
    { type: 'body', parameters: [{ type: 'text', text: 'Joana' }] }
  ]
});

// Free-form text (ONLY within 24h window after the contact's last inbound)
await meta.messaging.sendText({
  accessToken, phoneNumberId,
  to: '5511999999999',
  body: 'Posso ajudar?'
});

// Interactive buttons (within 24h window, OR via approved button-based template)
await meta.messaging.sendInteractive({
  accessToken, phoneNumberId,
  to: '5511999999999',
  interactive: {
    type: 'button',
    body: { text: 'Quer renovar agora?' },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'YES', title: 'Sim, renovar' } },
        { type: 'reply', reply: { id: 'LATER', title: 'Depois' } }
      ]
    }
  }
});

// Media (upload then send)
const { id: mediaId } = await meta.media.upload({
  accessToken, phoneNumberId,
  buffer, mimeType: 'image/jpeg', filename: 'product.jpg'
});
await meta.messaging.sendMedia({
  accessToken, phoneNumberId,
  to: '5511999999999',
  type: 'image',
  mediaId,
  caption: 'Aqui está'
});
```

### Errors — `MetaApiError`

Every Cloud API failure is thrown as `MetaApiError` with all Meta fields preserved:

```javascript
const { MetaApiError, META_ERROR_CODES } = require('@guilhermegoulart1/relay-core');

try {
  await meta.messaging.sendTemplate({ ... });
} catch (err) {
  if (err instanceof MetaApiError) {
    if (err.metaCode === META_ERROR_CODES.TEMPLATE_NOT_APPROVED) {
      // Resync templates and surface "template under review" to the user
    } else if (err.metaCode === META_ERROR_CODES.RATE_LIMIT) {
      // Retry later — err.isRetryable() === true
    } else if (err.metaCode === META_ERROR_CODES.WINDOW_EXPIRED) {
      // Switch to template send
    }
    console.error(err.metaTraceId);  // Meta support reference
  }
  throw err;
}
```

### Templates

Local mirror is the app's responsibility (the Relay doesn't store anything).
Apps typically call `templates.listAll()` periodically and on-demand, plus
listen to `EventTypes.TEMPLATE_STATUS_CHANGED` webhooks to update their
local cache without polling.

```javascript
const all = await meta.templates.listAll({
  accessToken, businessAccountId
});
// => Array of { id, name, language, category, status, components, ... }

// Create a template (Meta reviews → status starts PENDING typically)
await meta.templates.create({
  accessToken, businessAccountId,
  name: 'lembrete_renovacao',
  language: 'pt_BR',
  category: 'UTILITY',
  components: [
    { type: 'BODY', text: 'Olá {{1}}, seu certificado vence em {{2}}.',
      example: { body_text: [['Joana', '10/05/2026']] } },
    { type: 'BUTTONS', buttons: [
      { type: 'QUICK_REPLY', text: 'Renovar agora' },
      { type: 'QUICK_REPLY', text: 'Mais tarde' }
    ]}
  ]
});
```

### Webhooks

Cloud API webhooks need TWO things from the app:

1. **Capture raw body** for HMAC validation (Express needs a `verify` callback):
2. **Iterate the array** — `parseCloudApiWebhook` returns `NormalizedEvent[]`
   because Cloud API batches up to ~100 events per POST.

```javascript
const { parseCloudApiWebhook, validateCloudApiSignature } =
  require('@guilhermegoulart1/relay-core');

app.use('/webhooks/meta', express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// GET handshake
app.get('/webhooks/meta', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === expectedToken) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// POST events
app.post('/webhooks/meta', (req, res) => {
  if (!validateCloudApiSignature(
    req.rawBody, req.headers['x-hub-signature-256'], appSecret
  )) return res.sendStatus(401);

  for (const event of parseCloudApiWebhook(req.body)) {
    // event.accountId === phoneNumberId for messages/statuses,
    // === businessAccountId for template/account events.
    // Use it for multi-tenant resolution against your DB.
    emitter.emit(event);
  }
  res.sendStatus(200);
});
```

#### Event mapping

| Webhook field | Refined by | Normalized type |
|---|---|---|
| `messages[]` (text/image/video/audio/document/sticker/location/contact/button/interactive/reaction) | — | `MESSAGE_RECEIVED` (always; Meta only delivers inbound) |
| `statuses[].status === 'sent'` | — | `MESSAGE_SENT` |
| `statuses[].status === 'delivered'` | — | `MESSAGE_DELIVERED` |
| `statuses[].status === 'read'` | — | `MESSAGE_READ` |
| `statuses[].status === 'failed'` | — | `MESSAGE_FAILED` (errors[] in `metadata.errors`) |
| change-level `errors[]` | — | `MESSAGE_FAILED` |
| `field === 'message_template_status_update'` | `value.event` | `TEMPLATE_STATUS_CHANGED` (newStatus + reason in metadata) |
| `field === 'account_update'`, `business_capability_update`, `phone_number_quality_update`, `phone_number_name_update` | — | `ACCOUNT_STATUS_CHANGED` |
| Other / new fields | — | `UNKNOWN` (with `metadata.originalEvent`) |

### Helpers (opt-in pure functions)

```javascript
const { effectiveDailyLimit, stableVariant, isInWindow } =
  require('@guilhermegoulart1/relay-core');

// Pace your dispatcher 80% below Meta's tier
const cap = effectiveDailyLimit(tier);
// tier accepts numbers (250, 1000, 10000, 100000, Infinity)
// AND Meta's strings ('TIER_1K', 'TIER_100K', 'TIER_UNLIMITED')

// Deterministic A/B split for mass send
const variant = stableVariant(contact.id, { salt: campaign.id });

// 24h customer-service window check before allowing free-form sends
if (isInWindow(conversation.lastInboundAt)) {
  await meta.messaging.sendText({ ... });
} else {
  await meta.messaging.sendTemplate({ ... });
}
```

### Multi-tenant pattern

```javascript
// 1. Persist per tenant in your DB:
//    accessToken (encrypted), phoneNumberId, businessAccountId, verifyToken

// 2. Singleton provider:
const meta = new MetaCloudApiProvider({ apiVersion: 'v22.0', appSecret });

// 3. Resolve creds per request:
const creds = await db.loadCredsForTenant(tenantId);
await meta.messaging.sendTemplate({
  accessToken: creds.accessToken,
  phoneNumberId: creds.phoneNumberId,
  to, templateName, language, components
});

// 4. In webhook handler, route by event.accountId (= phoneNumberId):
for (const event of parseCloudApiWebhook(req.body)) {
  const tenant = await db.findTenantByPhoneNumberId(event.accountId);
  if (!tenant) continue;
  emitter.emit(event, { tenant });
}
```

### Verifying credentials at setup

```javascript
const info = await meta.account.verifyConnection({
  accessToken, phoneNumberId
});
// Throws MetaApiError if creds are bad. Otherwise:
// => { ok: true, id, displayPhoneNumber, verifiedName, qualityRating, tier }
```

---

## Webchat Provider

First-party embeddable chat channel. Architecturally unique among Relay
providers: there is no external API to wrap — your Express server **is** the
chat backend. The Relay supplies the protocol contract (HTTP routes,
NormalizedEvent emission, realtime hooks) and lets you inject `Storage` and
`Realtime` adapters for full control over persistence and transport.

### Components

| Component | Type | Description |
|-----------|------|-------------|
| `WebchatProvider` | class | Provider with messaging manager (agent/AI → visitor) |
| `createWebchatHandler({...})` | factory | Mounts 5 public Express routes |
| `WebchatStorageAdapter` | abstract | Persistence contract — apps implement |
| `WebchatRealtimeAdapter` | abstract | Realtime contract — apps implement |
| `SSERealtimeAdapter` | class | Zero-dep default realtime (single-process SSE) |
| `InMemoryWebchatStorage` | class | Zero-dep default storage (POCs/tests) |
| `parseWebchatWebhook(payload)` | fn | Payload → `NormalizedEvent` |
| `@guilhermegoulart1/relay-webchat-widget` | pkg | Embeddable widget (separate package) |

### Configuration

```javascript
const express = require('express');
const {
  createWebchatHandler,
  InMemoryWebchatStorage,
  SSERealtimeAdapter,
  MessagingEventEmitter,
  EventTypes
} = require('@guilhermegoulart1/relay-core');

// 1. Storage — InMemory for POCs; write your own DB-backed for production
const storage = new InMemoryWebchatStorage();
storage.seedChannel({
  widgetKey: 'YOUR_32_CHAR_HEX_KEY',
  accountId: 'your-tenant-id',
  agent_name: 'Support',
  welcome_message: 'Hi! How can we help?',
  pre_chat_form: { enabled: true, fields: ['name', 'email'] },
  allowed_origins: ['https://customer.com'],   // empty = allow all
  is_active: true
});

// 2. Realtime — SSE built-in; or your own adapter for multi-pod / hosted services
const realtime = new SSERealtimeAdapter();

// 3. Emitter — same one used by Unipile/Uazapi handlers
const emitter = new MessagingEventEmitter();
emitter.on(EventTypes.MESSAGE_RECEIVED, (event) => {
  if (event.providerType !== 'WEBCHAT') return;
  // Visitor sent a message — same shape as Unipile/Uazapi events
  console.log(event.senderName, '->', event.content);
});

// 4. Mount the handler
const app = express();
app.use('/api/public/webchat', createWebchatHandler({ storage, realtime, emitter }));

// 5. Serve the widget bundle
app.use('/widget/dist', express.static(
  require('path').dirname(
    require.resolve('@guilhermegoulart1/relay-webchat-widget/package.json')
  ) + '/dist'
));
```

### Public routes mounted by the factory

| Method & Path | Purpose | Body / Query |
|--------------|---------|--------------|
| `GET /:widgetKey/config` | Return public widget config (theme, agent name, etc.) | — |
| `POST /:widgetKey/session` | Create/resume a visitor session, return realtime info | `{ visitorToken?, name?, email?, phone?, pageUrl? }` |
| `POST /:widgetKey/message` | Visitor sends a message; persisted + fan-out + emitter | `{ conversationId, visitorToken, content }` |
| `POST /:widgetKey/identify` | Provide identity; optionally links to a contact | `{ visitorToken, name?, email?, phone?, company? }` |
| `GET /:widgetKey/history` | Paginated history with ownership check | `?conversationId&visitorToken&limit&before` |

Plus, when `SSERealtimeAdapter` is used, a `GET /_relay/sse` endpoint is
mounted for the EventSource stream. Other realtime adapters mount their own
endpoints (or none, if they use a hosted service).

### Storage adapter contract

Apps implement `WebchatStorageAdapter` against their database. Methods:

```js
class MyWebchatStorage extends WebchatStorageAdapter {
  // Channel config
  async getChannelByWidgetKey(widgetKey)         // returns full channel record
  async getPublicWidgetConfig(widgetKey)         // returns public-safe config

  // Visitors
  async findVisitor(visitorToken)
  async createVisitor({ accountId, channelId, profile, metadata })
  async updateVisitorIdentity(visitorId, { name, email, phone, contactId })
  async touchVisitor(visitorId)

  // Contact linking (optional)
  async findContactByEmail(accountId, email)     // override-optional
  async createContact(accountId, profile)        // override-optional

  // Conversations
  async findOpenConversationForVisitor(visitorId)
  async createConversation({ accountId, channelId, visitorId, contactId })
  async getConversationForVisitor(conversationId, visitorId)   // ownership check
  async setConversationContact(conversationId, contactId)
  async updateConversationOnNewMessage(conversationId, { lastPreview, lastAt, fromVisitor })

  // Messages
  async insertMessage({ conversationId, accountId, senderType, content, providerType })
  async loadHistory(conversationId, { limit, before })
}
```

The Relay **never touches SQL**. Use Postgres, Mongo, SQLite, Drizzle, Prisma —
your call. See [examples/webchat/server.js](../examples/webchat/) for the
complete in-memory reference, and [c:\getraze\backend\src\services\webchatStorageAdapter.js](c:\getraze\backend\src\services\webchatStorageAdapter.js)
for a Postgres reference (after migration to v1.9.0).

### Realtime adapter contract

```js
class MyWebchatRealtime extends WebchatRealtimeAdapter {
  async publish(channel, event, data)             // server-side fan-out
  async getWidgetConnectionInfo(ctx)              // tells widget how to subscribe
  attachServerHandlers(router, { storage })       // optional: mount /stream or /ws
  isAvailable()                                    // readiness check
}
```

Channel naming convention:
- `conversation:{conversationId}` — visitor + agents subscribed
- `account:{accountId}` — agents/dashboard only

Standard event names: `new_message`, `conversation_updated`, `message_read`.

#### Available implementations

| Adapter | Where it lives | Use case |
|---------|----------------|----------|
| `SSERealtimeAdapter` | Shipped in `relay-core` | Single-process app, zero deps |
| Custom WebSocket | Write yourself | Single-process, lower latency than SSE |
| Ably / Pusher / PubNub | Write yourself; see [examples/webchat-ably/](../examples/webchat-ably/) | Multi-pod, hosted, auto-scaling |
| Redis pub/sub on top of SSE/WS | Write yourself | Multi-pod, self-hosted |

The Relay deliberately **does not ship adapters for paid third-party services**.
Implementing one is ~50 LOC; the Ably reference example shows the pattern.

### Widget integration

```html
<script
  src="https://your-app.com/widget/dist/widget.js"
  data-widget-key="YOUR_32_CHAR_HEX_KEY"
  data-api-url="https://your-app.com"
  defer
></script>
```

The widget auto-detects the realtime transport from the `/session` response
and connects accordingly. SSE and WebSocket are built in; for custom
transports (Ably, Pusher, ...) load a transport plugin script that registers
via `RelayWebchat.registerTransport(name, factory)` BEFORE the widget connects.

### NormalizedEvent shape

Every visitor message emitted on the configured `MessagingEventEmitter`:

```js
{
  type: 'message.received',           // EventTypes.MESSAGE_RECEIVED
  provider: 'webchat',
  providerType: 'WEBCHAT',            // ProviderTypes.WEBCHAT
  accountId, chatId, messageId,
  senderId,                            // visitor ID
  senderName,                          // display_name from visitor
  content,                             // text
  timestamp,                           // ISO
  attachments: [],                     // future: file uploads
  metadata: {
    widgetKey, channelId,
    senderType: 'lead' | 'user' | 'ai',
    visitorToken, visitorEmail, visitorPhone, contactId,
    pageUrl, referrer, userAgent, ip,
    isResume                           // first message of a resumed session?
  },
  raw: <original payload>
}
```

Outbound messages (sent via `webchat.messaging.sendMessage(...)`) emit
`MESSAGE_SENT` with the same shape — symmetry that lets handlers be
provider-agnostic.

### Security

- **CORS**: dynamic per channel via `channel.allowed_origins`. Empty array = allow all (dev).
- **Visitor token**: 32-byte hex, stored in `localStorage` under `relay_vt_${widgetKey}`,
  validated against storage on every request.
- **Rate limiting**: defaults via `express-rate-limit` (peer dep optional) —
  30 req/min for `/message`, 10 req/min for `/session`. Pass your own to override.
- **Ownership**: every visitor request resolves `(channel, visitor, conversation)`
  and rejects mismatches with 403.
- **No HMAC**: webchat is not a third-party webhook. The token + origin checks
  are the security model.

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
