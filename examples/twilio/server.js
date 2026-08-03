/**
 * Twilio (SMS / MMS / WhatsApp) — example Express server.
 *
 * Demonstrates:
 *   - Webhook POST: X-Twilio-Signature validation + parseTwilioWebhook + emitter
 *   - Replying with TwiML (or empty TwiML when you dispatch via the REST API)
 *   - Sending an SMS and a WhatsApp message via the messaging manager
 *   - Listening to MESSAGE_RECEIVED / SENT / DELIVERED / READ / FAILED
 *
 * In a real app, credentials are per-tenant — load them from your DB and pass
 * to each call. Here we use one set from env for simplicity.
 *
 * IMPORTANT: Twilio webhooks are application/x-www-form-urlencoded (NOT JSON),
 * so the webhook route uses express.urlencoded().
 */

require('dotenv').config();
const express = require('express');
const {
  TwilioProvider,
  parseTwilioWebhook,
  validateTwilioSignature,
  messagingResponse,
  emptyMessagingResponse,
  MessagingEventEmitter,
  EventTypes,
  TWILIO_ERROR_CODES
} = require('@brainhours/relay-core');

const PORT = process.env.PORT || 3000;
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_CONNECT_APP_SID,
  TWILIO_SMS_FROM,
  TWILIO_WHATSAPP_FROM = '+14155238886',
  TWILIO_MESSAGING_SERVICE_SID,
  DEMO_TO
} = process.env;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const twilio = new TwilioProvider({
  accountSid: TWILIO_ACCOUNT_SID,
  authToken: TWILIO_AUTH_TOKEN,
  apiKeySid: TWILIO_API_KEY_SID,
  apiKeySecret: TWILIO_API_KEY_SECRET,
  connectAppSid: TWILIO_CONNECT_APP_SID   // CN… — for Twilio Connect (OAuth)
});

if (!twilio.isInitialized()) {
  console.warn('[warn] Twilio not fully configured:', twilio.getError());
}

// ---------------------------------------------------------------------------
// Emitter — same shape as Unipile/Uazapi/Cloud API/Webchat handlers
// ---------------------------------------------------------------------------

const emitter = new MessagingEventEmitter();

emitter.on(EventTypes.MESSAGE_RECEIVED, (event) => {
  if (event.provider !== 'twilio') return;
  console.log(
    `[in]  ${event.metadata.channel} ${event.senderName || event.senderId}: ${event.content}` +
      (event.attachments.length ? ` (+${event.attachments.length} media)` : '')
  );
});

emitter.on(EventTypes.MESSAGE_SENT, (event) => {
  if (event.provider !== 'twilio') return;
  console.log(`[->]  ${event.messageId} status=${event.metadata.status}`);
});

emitter.on(EventTypes.MESSAGE_DELIVERED, (event) => {
  if (event.provider !== 'twilio') return;
  console.log(`[ok]  delivered: ${event.messageId} → ${event.chatId}`);
});

emitter.on(EventTypes.MESSAGE_READ, (event) => {
  if (event.provider !== 'twilio') return;
  console.log(`[👁]   read: ${event.messageId}`);
});

emitter.on(EventTypes.MESSAGE_FAILED, (event) => {
  if (event.provider !== 'twilio') return;
  console.log(
    `[fail] ${event.messageId}: code=${event.metadata.errorCode} ${event.metadata.errorMessage || ''}`
  );
});

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------

const app = express();

// Twilio webhooks are form-encoded. This MUST be urlencoded (not json).
app.post('/webhooks/twilio', express.urlencoded({ extended: false }), (req, res) => {
  // Twilio signs the PUBLIC URL it called (incl. query string). Behind a proxy,
  // rebuild it from X-Forwarded-Proto + Host.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${proto}://${req.headers.host}${req.originalUrl}`;

  const ok = validateTwilioSignature(
    url,
    req.body,
    req.headers['x-twilio-signature'],
    TWILIO_AUTH_TOKEN
  );
  if (!ok) {
    console.warn('[warn] invalid X-Twilio-Signature — rejecting');
    return res.sendStatus(403);
  }

  const event = parseTwilioWebhook(req.body);
  emitter.emit(event, { req });

  // Auto-reply to inbound text with TwiML; otherwise take no action.
  if (event.type === EventTypes.MESSAGE_RECEIVED && event.content) {
    return res
      .type('text/xml')
      .send(messagingResponse(`Recebido: "${event.content}". Obrigado!`));
  }
  res.type('text/xml').send(emptyMessagingResponse());
});

// API: send an SMS
app.post('/api/send-sms', express.json(), async (req, res) => {
  const { to = DEMO_TO, body = 'Hello from Relay + Twilio!' } = req.body || {};
  try {
    const result = await twilio.messaging.sendSms({
      to,
      from: TWILIO_MESSAGING_SERVICE_SID ? undefined : TWILIO_SMS_FROM,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      body,
      statusCallback: req.body?.statusCallback
    });
    res.json({ sid: result.sid, status: result.status });
  } catch (err) {
    handleTwilioError(err, res);
  }
});

// API: send a WhatsApp message (free-form — only valid inside the 24h window)
app.post('/api/send-whatsapp', express.json(), async (req, res) => {
  const { to = DEMO_TO, body = 'Olá from Relay + Twilio!' } = req.body || {};
  try {
    const result = await twilio.messaging.sendWhatsApp({
      to,
      from: TWILIO_WHATSAPP_FROM,
      body
    });
    res.json({ sid: result.sid, status: result.status });
  } catch (err) {
    handleTwilioError(err, res);
  }
});

// ---------------------------------------------------------------------------
// Twilio Connect (OAuth-style onboarding) — alternative to pasting creds.
// Configure the Connect App's "Authorize URL" to point at /twilio/connect/callback.
// ---------------------------------------------------------------------------

// 1) Redirect the customer to Twilio's hosted authorize screen.
app.get('/twilio/connect/start', (_req, res) => {
  if (!TWILIO_CONNECT_APP_SID) return res.status(500).send('Set TWILIO_CONNECT_APP_SID');
  // In a real app, sign `state` (e.g. a JWT of the user/session) for CSRF.
  const state = `demo-${Date.now()}`;
  res.redirect(twilio.connect.getAuthorizeUrl({ state }));
});

// 2) Twilio redirects back here with ?AccountSid=…&state=… (or ?error=…).
app.get('/twilio/connect/callback', (req, res) => {
  const { ok, accountSid, state, error, errorDescription } = twilio.connect.parseCallback(req.query);
  if (!ok) {
    return res.status(400).json({ error: error || 'denied', errorDescription });
  }
  // Persist { accountSid, authMode: 'connect' } for this tenant; send on its
  // behalf later with the connected accountSid + your master Auth Token.
  console.log(`[connect] authorized AccountSid=${accountSid} state=${state}`);
  res.json({ connected: true, accountSid, state });
});

// 3) Twilio POSTs here (form-encoded, signed) when a customer removes your app.
app.post('/twilio/connect/deauthorize', express.urlencoded({ extended: false }), (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${proto}://${req.headers.host}${req.originalUrl}`;
  // Deauthorize callbacks are signed with your CONNECT APP's (master) Auth Token.
  if (!validateTwilioSignature(url, req.body, req.headers['x-twilio-signature'], TWILIO_AUTH_TOKEN)) {
    return res.sendStatus(403);
  }
  const { accountSid, connectAppSid } = twilio.connect.parseDeauthorize(req.body);
  console.log(`[connect] deauthorized AccountSid=${accountSid} app=${connectAppSid}`);
  // db.disconnectTwilioChannelsByAccountSid(accountSid)
  res.sendStatus(200);
});

// API: verify connection (great for setup screens)
app.get('/api/verify-connection', async (_req, res) => {
  try {
    const info = await twilio.account.verifyConnection({});
    res.json(info);
  } catch (err) {
    handleTwilioError(err, res);
  }
});

function handleTwilioError(err, res) {
  if (err.twilioCode === TWILIO_ERROR_CODES.WHATSAPP_FREEFORM_OUTSIDE_WINDOW) {
    return res.status(422).json({ error: 'outside_24h_window — use a template', code: err.twilioCode });
  }
  if (err.twilioCode === TWILIO_ERROR_CODES.TOO_MANY_REQUESTS || err.statusCode === 429) {
    return res.status(429).json({ error: 'rate_limited', code: err.twilioCode });
  }
  res.status(err.statusCode || 500).json({
    error: err.twilioMessage || err.message,
    code: err.twilioCode,
    moreInfo: err.moreInfo
  });
}

app.listen(PORT, () => {
  console.log(`Twilio example on http://localhost:${PORT}`);
  console.log(`  POST /webhooks/twilio          — inbound + status callbacks`);
  console.log(`  POST /api/send-sms             — send an SMS`);
  console.log(`  POST /api/send-whatsapp        — send a WhatsApp message`);
  console.log(`  GET  /api/verify-connection    — sanity check creds`);
  console.log(`  GET  /twilio/connect/start     — Connect (OAuth) onboarding`);
  console.log(`  GET  /twilio/connect/callback  — Connect redirect-back`);
  console.log(`  POST /twilio/connect/deauthorize — Connect removal callback`);
});
