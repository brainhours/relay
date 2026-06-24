/**
 * Twilio webhook parser + signature validator.
 *
 * IMPORTANT: Twilio POSTs webhooks as `application/x-www-form-urlencoded`, NOT
 * JSON. Mount `express.urlencoded({ extended: false })` on the route so
 * `req.body` is the flat string map this parser expects.
 *
 * Twilio sends TWO kinds of messaging webhook to the same (or different) URLs:
 *
 *   1. Inbound message  — the customer messaged your number. Carries `Body`,
 *      `From`, `To`, `MessageSid`, `NumMedia`, and (WhatsApp) `ProfileName`,
 *      `WaId`, button/interactive fields. `SmsStatus` is `received`.
 *
 *   2. Status callback  — the lifecycle of a message YOU sent. Carries
 *      `MessageStatus` (queued → sending → sent → delivered → read, or
 *      undelivered/failed) plus `ErrorCode` on failure. Configure the URL via
 *      `statusCallback` on send, or on the Messaging Service.
 *
 * `parseTwilioWebhook` returns a single NormalizedEvent (1:1, like Uazapi/Wati —
 * unlike Cloud API which batches).
 *
 * Channel (SMS vs WhatsApp) is inferred from the `whatsapp:` prefix on the
 * addresses; the normalized `senderId`/`chatId` are the BARE E.164 numbers
 * (prefix stripped) so downstream code is channel-agnostic.
 *
 * @see https://www.twilio.com/docs/messaging/guides/webhook-request
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */

const { createHmac, timingSafeEqual } = require('crypto');
const { EventTypes, NormalizedEvent, ProviderTypes } = require('../../events/types');
const { parseChannelAddress } = require('./addresses');

// ---------------------------------------------------------------------------
// Status → normalized type
// ---------------------------------------------------------------------------

/**
 * Twilio message status (`MessageStatus`/`SmsStatus`) → normalized EventType.
 * Pre-send states (queued/sending/accepted/scheduled) and `sent` all map to
 * MESSAGE_SENT; the precise Twilio value is preserved in `metadata.status`.
 */
const TWILIO_STATUS_MAP = Object.freeze({
  received: EventTypes.MESSAGE_RECEIVED,
  accepted: EventTypes.MESSAGE_SENT,
  scheduled: EventTypes.MESSAGE_SENT,
  queued: EventTypes.MESSAGE_SENT,
  sending: EventTypes.MESSAGE_SENT,
  sent: EventTypes.MESSAGE_SENT,
  delivered: EventTypes.MESSAGE_DELIVERED,
  read: EventTypes.MESSAGE_READ,
  undelivered: EventTypes.MESSAGE_FAILED,
  failed: EventTypes.MESSAGE_FAILED
});

// ---------------------------------------------------------------------------
// Public: parse
// ---------------------------------------------------------------------------

/**
 * Parse a Twilio webhook (the form-decoded body) into a NormalizedEvent.
 *
 * @param {Object} rawPayload - the parsed `application/x-www-form-urlencoded` body
 * @returns {NormalizedEvent}
 */
function parseTwilioWebhook(rawPayload = {}) {
  const p = rawPayload || {};

  // Status string can be on either key depending on the event/channel.
  const statusRaw = String(p.MessageStatus || p.SmsStatus || '').toLowerCase();
  const isInbound = !!(p.Body !== undefined || p.NumMedia !== undefined) && (statusRaw === '' || statusRaw === 'received');

  const type = isInbound
    ? EventTypes.MESSAGE_RECEIVED
    : TWILIO_STATUS_MAP[statusRaw] || EventTypes.UNKNOWN;

  // On inbound, the customer is `From`. On a status callback, the message we
  // sent went `To` the customer — that's the conversation key in both cases.
  const customerRaw = isInbound ? p.From : p.To;
  const { channel, address: customer } = parseChannelAddress(customerRaw);
  const { address: business } = parseChannelAddress(isInbound ? p.To : p.From);

  const providerType = channel === 'whatsapp' ? ProviderTypes.WHATSAPP : ProviderTypes.SMS;

  // Tenant identity: the Account SID is always present. The business number
  // (and MessagingServiceSid) are surfaced in metadata for finer routing.
  const accountId = p.AccountSid || p.MessagingServiceSid || null;

  const messageId = p.MessageSid || p.SmsSid || p.SmsMessageSid || null;

  const metadata = {
    originalEvent: isInbound ? 'inbound' : 'status',
    channel,
    status: statusRaw || undefined,
    to: business || undefined,
    from: customer || undefined,
    accountSid: p.AccountSid || undefined,
    messagingServiceSid: p.MessagingServiceSid || undefined,
    numSegments: p.NumSegments !== undefined ? Number(p.NumSegments) : undefined,
    numMedia: p.NumMedia !== undefined ? Number(p.NumMedia) : undefined,
    profileName: p.ProfileName || undefined,
    waId: p.WaId || undefined,
    messageType: p.MessageType || undefined,
    errorCode: p.ErrorCode !== undefined ? Number(p.ErrorCode) : undefined,
    errorMessage: p.ErrorMessage || undefined,
    price: p.Price || undefined,
    priceUnit: p.PriceUnit || undefined,
    // WhatsApp interactive / button replies
    buttonText: p.ButtonText || undefined,
    buttonPayload: p.ButtonPayload || undefined,
    // quoted / reply context (WhatsApp)
    originalRepliedMessageSid: p.OriginalRepliedMessageSid || undefined,
    // geo (inbound SMS location share)
    latitude: p.Latitude || undefined,
    longitude: p.Longitude || undefined,
    // inbound sender geo (carrier-provided)
    fromCity: p.FromCity || undefined,
    fromState: p.FromState || undefined,
    fromCountry: p.FromCountry || undefined
  };
  for (const k of Object.keys(metadata)) {
    if (metadata[k] === undefined) delete metadata[k];
  }

  return new NormalizedEvent({
    type,
    provider: 'twilio',
    providerType,
    accountId,
    chatId: customer || null,
    messageId,
    senderId: isInbound ? customer || null : business || null,
    senderName: p.ProfileName || null,
    content: p.Body || '',
    timestamp: new Date().toISOString(), // Twilio webhooks carry no event ts; stamp on receipt
    attachments: extractAttachments(p),
    metadata,
    raw: rawPayload
  });
}

/**
 * Collect inbound media (MediaUrl0..N / MediaContentType0..N) into the
 * normalized attachment shape.
 * @private
 */
function extractAttachments(p) {
  const n = Number(p.NumMedia || 0);
  if (!Number.isFinite(n) || n <= 0) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const url = p[`MediaUrl${i}`];
    if (!url) continue;
    out.push({
      url,
      mimeType: p[`MediaContentType${i}`] || undefined,
      // The Media SID is the last path segment of the URL.
      id: typeof url === 'string' ? url.split('/').pop() : undefined
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public: validate signature (X-Twilio-Signature)
// ---------------------------------------------------------------------------

/**
 * Compute the expected `X-Twilio-Signature` for a request.
 *
 * Algorithm (form-encoded webhooks): take the full request URL, append each
 * POST param as `key + value` in alphabetical key order, HMAC-SHA1 with the
 * Auth Token, base64-encode.
 *
 * @param {string} authToken
 * @param {string} url      - the EXACT URL Twilio called (scheme + host + path + query)
 * @param {Object} params   - the POST body params
 * @returns {string} base64 signature
 */
function computeTwilioSignature(authToken, url, params) {
  let data = String(url || '');
  const keys = Object.keys(params || {}).sort();
  for (const k of keys) {
    const v = params[k];
    data += k + (v == null ? '' : String(v));
  }
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

/**
 * Validate the `X-Twilio-Signature` header.
 *
 * The `url` MUST exactly match what Twilio used to sign — including scheme,
 * host and query string. Behind a proxy/load-balancer, rebuild it from
 * `X-Forwarded-Proto` + `Host` (Twilio always signs the PUBLIC URL it called),
 * e.g. `https://${req.headers.host}${req.originalUrl}`.
 *
 * If `authToken` is falsy, returns true (dev/test convenience). Apps SHOULD set
 * it in production.
 *
 * @param {string} url
 * @param {Object} params           - the form-decoded request body
 * @param {string} signatureHeader  - value of `X-Twilio-Signature`
 * @param {string} authToken        - Twilio Auth Token (NOT an API Key secret)
 * @returns {boolean}
 */
function validateTwilioSignature(url, params, signatureHeader, authToken) {
  if (!authToken) return true;
  if (typeof signatureHeader !== 'string' || signatureHeader.length === 0) return false;

  const expected = computeTwilioSignature(authToken, url, params || {});
  try {
    const a = Buffer.from(expected, 'utf-8');
    const b = Buffer.from(signatureHeader, 'utf-8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Deterministic job ID for queue dedup (Bull `jobId`, etc.).
 * @param {NormalizedEvent} event
 * @returns {string}
 */
function generateWebhookJobId(event) {
  return ['twilio', event.type, event.accountId, event.messageId || event.timestamp]
    .filter(Boolean)
    .join(':');
}

module.exports = {
  parseTwilioWebhook,
  validateTwilioSignature,
  computeTwilioSignature,
  generateWebhookJobId,
  TWILIO_STATUS_MAP
};
