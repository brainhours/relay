/**
 * Uazapi Webhook Example — Express
 *
 * - Provisions WhatsApp instances across a cluster of Uazapi servers
 *   (round-robin, weighted, least-loaded, ...).
 * - Receives webhook events at /webhooks/uazapi and routes them through
 *   a MessagingEventEmitter.
 *
 * The example uses an in-memory store for instances. In production, persist
 * `(tenantId, serverId, instanceId, instanceToken)` in your own database and
 * inject them when calling messaging operations.
 */

require('dotenv').config();
const express = require('express');
const {
  UazapiProvider,
  parseWebhook,
  EventTypes,
  MessagingEventEmitter
} = require('@guilhermegoulart1/relay-core');

// ---------------------------------------------------------------------------
// Provider setup — supports both single-server and multi-server modes via env
// ---------------------------------------------------------------------------

function buildProviderConfig() {
  if (process.env.UAZ_SERVERS) {
    return {
      servers: JSON.parse(process.env.UAZ_SERVERS),
      selectionStrategy: process.env.UAZ_STRATEGY || 'round-robin',
      // App-side load callback. In a real app, query your DB.
      getServerLoad: async (serverId) => store.countByServer(serverId)
    };
  }
  return {
    baseUrl: process.env.UAZ_BASE_URL,
    adminToken: process.env.UAZ_ADMIN_TOKEN
  };
}

// In-memory store for the example. Swap with your DB.
const store = {
  byTenant: new Map(),       // tenantId -> { serverId, instanceId, token }
  byInstance: new Map(),     // instanceId -> { serverId, token, tenantId }

  put(tenantId, rec) {
    this.byTenant.set(tenantId, rec);
    if (rec.instanceId) this.byInstance.set(rec.instanceId, { ...rec, tenantId });
  },
  getByTenant(t) { return this.byTenant.get(t) || null; },
  getByInstance(i) { return this.byInstance.get(i) || null; },
  countByServer(serverId) {
    let n = 0;
    for (const v of this.byTenant.values()) if (v.serverId === serverId) n++;
    return n;
  }
};

const uazapi = new UazapiProvider(buildProviderConfig());
if (!uazapi.isInitialized()) {
  console.error('Uazapi provider error:', uazapi.getError());
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

const emitter = new MessagingEventEmitter();

emitter.on(EventTypes.MESSAGE_RECEIVED, async (event) => {
  console.log(
    `[msg]    ← ${event.senderName || event.senderId}  (${event.metadata.isGroup ? 'group' : 'dm'}):`,
    event.content
  );
});

emitter.on(EventTypes.MESSAGE_SENT, async (event) => {
  console.log(`[msg]    → ${event.chatId}: ${event.content}`);
});

emitter.on(EventTypes.MESSAGE_READ, (event) => {
  console.log(`[read]   message ${event.messageId} read in ${event.chatId}`);
});

emitter.on(EventTypes.ACCOUNT_CONNECTED, (event) => {
  console.log(`[conn]   instance ${event.accountId} connected`);
});

emitter.on(EventTypes.ACCOUNT_DISCONNECTED, (event) => {
  console.log(
    `[conn]   instance ${event.accountId} disconnected:`,
    event.metadata.lastDisconnectReason
  );
});

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

/**
 * Webhook endpoint. Configure Uazapi to POST events here.
 * Optional ?secret=<value> for spoof protection.
 */
app.post('/webhooks/uazapi', async (req, res) => {
  if (process.env.WEBHOOK_SECRET && req.query.secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'invalid_secret' });
  }
  try {
    const event = parseWebhook('uazapi', req.body);
    await emitter.emit(event, { uazapi, store, req });
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Provisioning endpoint:
 *   POST /api/connect { tenantId }
 * Creates a Uazapi instance, configures the webhook, opens a QR.
 */
app.post('/api/connect', async (req, res) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

    const created = await uazapi.instance.create({ name: tenantId });

    const webhookUrl =
      `${process.env.PUBLIC_URL}/webhooks/uazapi` +
      (process.env.WEBHOOK_SECRET ? `?secret=${process.env.WEBHOOK_SECRET}` : '');

    await uazapi.webhooks.set({
      token: created.token,
      serverId: created.serverId,
      url: webhookUrl,
      events: ['messages', 'messages_update', 'connection']
    });

    const conn = await uazapi.instance.connect({
      token: created.token,
      serverId: created.serverId
    });

    store.put(tenantId, {
      serverId: created.serverId,
      serverUrl: created.serverUrl,
      instanceId: created.id,
      token: created.token
    });

    res.json({
      tenantId,
      instanceId: created.id,
      serverId: created.serverId,
      qrcode: conn.instance?.qrcode,
      paircode: conn.instance?.paircode
    });
  } catch (err) {
    console.error('connect error:', err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Send a message:
 *   POST /api/send { tenantId, number, text }
 */
app.post('/api/send', async (req, res) => {
  try {
    const { tenantId, number, text } = req.body;
    const rec = store.getByTenant(tenantId);
    if (!rec) return res.status(404).json({ error: 'tenant not found' });

    const result = await uazapi.messaging.sendText({
      token: rec.token,
      serverId: rec.serverId,
      number,
      text
    });
    res.json(result);
  } catch (err) {
    console.error('send error:', err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Pool stats — useful for ops dashboards.
 *   GET /api/pool
 */
app.get('/api/pool', async (req, res) => {
  res.json(await uazapi.pool.stats());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Uazapi example listening on :${PORT}`);
  console.log(`Pool size: ${uazapi.pool.size()}`);
});
