/**
 * Meta WhatsApp Cloud API — example Express server.
 *
 * Demonstrates:
 *   - Webhook GET handshake (verify_token)
 *   - Webhook POST: HMAC validation + parseCloudApiWebhook + emitter dispatch
 *   - Sending a template via the messaging manager
 *   - Listening to MESSAGE_RECEIVED, MESSAGE_FAILED, TEMPLATE_STATUS_CHANGED
 *
 * In a real app, credentials are per-tenant — load them from your DB and pass
 * to each call. Here we use one set from env for simplicity.
 */

require('dotenv').config();
const express = require('express');
const {
  MetaCloudApiProvider,
  parseCloudApiWebhook,
  validateCloudApiSignature,
  MessagingEventEmitter,
  EventTypes,
  META_ERROR_CODES
} = require('@brainhours/relay-core');

const PORT = process.env.PORT || 3000;
const {
  META_APP_SECRET,
  META_ACCESS_TOKEN,
  META_PHONE_NUMBER_ID,
  WEBHOOK_VERIFY_TOKEN,
  DEMO_TO,
  DEMO_TEMPLATE_NAME = 'hello_world',
  DEMO_TEMPLATE_LANGUAGE = 'en_US'
} = process.env;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const meta = new MetaCloudApiProvider({
  apiVersion: 'v22.0',
  appSecret: META_APP_SECRET
});

// ---------------------------------------------------------------------------
// Emitter — same shape as Unipile/Uazapi handlers
// ---------------------------------------------------------------------------

const emitter = new MessagingEventEmitter();

emitter.on(EventTypes.MESSAGE_RECEIVED, (event) => {
  if (event.providerType !== 'WHATSAPP' || event.provider !== 'cloud-api') return;
  console.log(
    `[in]  ${event.senderName || event.senderId} — ${event.metadata.messageType}: ${event.content}`
  );
});

emitter.on(EventTypes.MESSAGE_DELIVERED, (event) => {
  if (event.provider !== 'cloud-api') return;
  console.log(`[ok]  delivered: ${event.messageId} → ${event.chatId}`);
});

emitter.on(EventTypes.MESSAGE_READ, (event) => {
  if (event.provider !== 'cloud-api') return;
  console.log(`[👁]   read: ${event.messageId}`);
});

emitter.on(EventTypes.MESSAGE_FAILED, (event) => {
  if (event.provider !== 'cloud-api') return;
  const err = (event.metadata.errors && event.metadata.errors[0]) || event.metadata.error;
  console.log(`[fail] ${event.messageId || '(no id)'}: code=${err?.code} title=${err?.title || err?.message}`);
});

emitter.on(EventTypes.TEMPLATE_STATUS_CHANGED, (event) => {
  console.log(
    `[tpl]  ${event.metadata.templateName} (${event.metadata.templateLanguage}) → ${event.metadata.newStatus}` +
      (event.metadata.reason ? ` (${event.metadata.reason})` : '')
  );
});

emitter.on(EventTypes.ACCOUNT_STATUS_CHANGED, (event) => {
  if (event.provider !== 'cloud-api') return;
  console.log(`[acct] ${event.metadata.originalEvent}`, event.metadata);
});

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------

const app = express();

// CRITICAL: capture raw body for HMAC validation. JSON parsing happens after.
app.use(
  '/webhooks/meta',
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

// GET handshake
app.get('/webhooks/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN && challenge) {
    return res.status(200).type('text/plain').send(challenge);
  }
  res.sendStatus(403);
});

// POST events
app.post('/webhooks/meta', async (req, res) => {
  const ok = validateCloudApiSignature(
    req.rawBody,
    req.headers['x-hub-signature-256'],
    META_APP_SECRET
  );
  if (!ok) return res.sendStatus(401);

  try {
    const events = parseCloudApiWebhook(req.body);
    for (const event of events) {
      // In production, dedupe here using event.messageId in a Redis cache before emitting
      await emitter.emit(event, { req });
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('webhook error:', err);
    res.sendStatus(500);
  }
});

// API: send a template
app.post('/api/send-template', express.json(), async (req, res) => {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    return res.status(500).json({ error: 'META_ACCESS_TOKEN and META_PHONE_NUMBER_ID required in env' });
  }
  const { to = DEMO_TO, templateName = DEMO_TEMPLATE_NAME, language = DEMO_TEMPLATE_LANGUAGE, components = [] } =
    req.body || {};

  try {
    const result = await meta.messaging.sendTemplate({
      accessToken: META_ACCESS_TOKEN,
      phoneNumberId: META_PHONE_NUMBER_ID,
      to,
      templateName,
      language,
      components
    });
    res.json(result);
  } catch (err) {
    if (err.metaCode === META_ERROR_CODES.TEMPLATE_NOT_APPROVED) {
      return res.status(422).json({ error: 'template_not_approved', metaCode: err.metaCode });
    }
    if (err.metaCode === META_ERROR_CODES.RATE_LIMIT) {
      return res.status(429).json({ error: 'rate_limited', metaCode: err.metaCode });
    }
    res.status(err.statusCode || 500).json({
      error: err.metaTitle || err.message,
      code: err.metaCode,
      traceId: err.metaTraceId
    });
  }
});

// API: verify connection (great for setup screens)
app.get('/api/verify-connection', async (_req, res) => {
  try {
    const info = await meta.account.verifyConnection({
      accessToken: META_ACCESS_TOKEN,
      phoneNumberId: META_PHONE_NUMBER_ID
    });
    res.json(info);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.metaTitle || err.message,
      code: err.metaCode
    });
  }
});

app.listen(PORT, () => {
  console.log(`Cloud API example on http://localhost:${PORT}`);
  console.log(`  GET  /webhooks/meta            — handshake`);
  console.log(`  POST /webhooks/meta            — events`);
  console.log(`  POST /api/send-template        — send a template`);
  console.log(`  GET  /api/verify-connection    — sanity check creds`);
});
