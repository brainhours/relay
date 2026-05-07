/**
 * Meta WhatsApp Cloud API webhook parser + signature validator.
 *
 * Cloud API webhooks are POSTed by Meta to the URL the app configured in the
 * Meta Business / WhatsApp app dashboard. Body shape (deeply nested):
 *
 *   {
 *     "object": "whatsapp_business_account",
 *     "entry": [{
 *       "id": "<WABA_ID>",
 *       "changes": [{
 *         "field": "messages" | "message_template_status_update" | "account_update" | ...,
 *         "value": { ... }
 *       }]
 *     }]
 *   }
 *
 * One POST may carry MANY events (Meta batches up to 100 messages per change).
 * `parseCloudApiWebhook` therefore returns an ARRAY of NormalizedEvent —
 * different from Unipile/Uazapi/Webchat parsers which are 1:1.
 *
 * Apps should iterate the array and emit each event on their MessagingEventEmitter.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/reference/whatsapp-business-account
 */

const { createHmac, timingSafeEqual } = require('crypto');
const { EventTypes, NormalizedEvent, ProviderTypes } = require('../../events/types');

// ---------------------------------------------------------------------------
// Public: parse
// ---------------------------------------------------------------------------

/**
 * Parse a Cloud API webhook payload into one or more NormalizedEvent.
 *
 * @param {Object} rawPayload
 * @returns {NormalizedEvent[]}
 */
function parseCloudApiWebhook(rawPayload = {}) {
  const events = [];
  if (!rawPayload || rawPayload.object !== 'whatsapp_business_account') return events;

  for (const entry of rawPayload.entry || []) {
    const wabaId = entry.id;
    for (const change of entry.changes || []) {
      const field = change.field;
      const value = change.value || {};
      const phoneNumberId = value.metadata && value.metadata.phone_number_id;
      const ctx = { wabaId, phoneNumberId, raw: change };

      if (field === 'messages') {
        const contacts = value.contacts || [];
        const contactByWaId = Object.create(null);
        for (const c of contacts) contactByWaId[c.wa_id] = c;

        for (const msg of value.messages || []) {
          events.push(buildInboundMessageEvent(msg, contactByWaId[msg.from], ctx));
        }
        for (const status of value.statuses || []) {
          events.push(buildStatusEvent(status, ctx));
        }
        for (const err of value.errors || []) {
          events.push(buildErrorEvent(err, ctx));
        }
      } else if (field === 'message_template_status_update') {
        events.push(buildTemplateStatusEvent(value, ctx));
      } else if (
        field === 'account_update' ||
        field === 'business_capability_update' ||
        field === 'phone_number_quality_update' ||
        field === 'phone_number_name_update'
      ) {
        events.push(buildAccountStatusEvent(value, field, ctx));
      } else {
        events.push(
          new NormalizedEvent({
            type: EventTypes.UNKNOWN,
            provider: 'cloud-api',
            providerType: ProviderTypes.WHATSAPP,
            accountId: phoneNumberId || wabaId,
            timestamp: new Date().toISOString(),
            metadata: { originalEvent: field, wabaId },
            raw: change
          })
        );
      }
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Public: validate signature (X-Hub-Signature-256)
// ---------------------------------------------------------------------------

/**
 * Validate the X-Hub-Signature-256 header against the raw request body using
 * the Meta App Secret. The header is `sha256=<hex>`.
 *
 * IMPORTANT: pass the RAW body (Buffer or string) before any JSON parsing.
 * Most Express setups use a custom verify hook to capture `req.rawBody`:
 *
 *   app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
 *
 * If `appSecret` is falsy, returns true (dev/test convenience). Apps SHOULD
 * set the secret in production.
 *
 * @param {Buffer|string} rawBody
 * @param {string} signatureHeader   - value of `X-Hub-Signature-256`
 * @param {string} appSecret         - Meta App Secret
 * @returns {boolean}
 */
function validateCloudApiSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return true;
  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  if (rawBody == null) return false;

  const expectedHex = signatureHeader.slice('sha256='.length).trim();
  if (!/^[a-f0-9]{64}$/i.test(expectedHex)) return false;

  // If the caller passed a parsed object instead of raw bytes, re-stringify as
  // a best-effort fallback. JSON.stringify preserves key order from JSON.parse,
  // so this often matches Meta's payload — but apps SHOULD always pass raw.
  let bodyBuf;
  if (Buffer.isBuffer(rawBody)) bodyBuf = rawBody;
  else if (typeof rawBody === 'string') bodyBuf = Buffer.from(rawBody, 'utf8');
  else bodyBuf = Buffer.from(JSON.stringify(rawBody), 'utf8');

  const computedHex = createHmac('sha256', appSecret).update(bodyBuf).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(computedHex, 'hex'));
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
  return ['cloud-api', event.type, event.accountId, event.messageId || event.timestamp]
    .filter(Boolean)
    .join(':');
}

// ---------------------------------------------------------------------------
// Internal: event builders
// ---------------------------------------------------------------------------

function tsToIso(unixSeconds) {
  if (unixSeconds == null) return new Date().toISOString();
  const n = typeof unixSeconds === 'number' ? unixSeconds : Number(unixSeconds);
  if (!Number.isFinite(n)) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

function pickContent(msg) {
  if (msg.text && msg.text.body) return msg.text.body;
  if (msg.button && msg.button.text) return msg.button.text;
  if (msg.interactive) {
    if (msg.interactive.button_reply) return msg.interactive.button_reply.title || '';
    if (msg.interactive.list_reply) return msg.interactive.list_reply.title || '';
    if (msg.interactive.nfm_reply) return msg.interactive.nfm_reply.body || '';
  }
  if (msg.image && msg.image.caption) return msg.image.caption;
  if (msg.video && msg.video.caption) return msg.video.caption;
  if (msg.document && msg.document.caption) return msg.document.caption;
  if (msg.location) {
    if (msg.location.name) return msg.location.name;
    return `${msg.location.latitude},${msg.location.longitude}`;
  }
  if (msg.contacts && msg.contacts.length > 0) {
    const c = msg.contacts[0];
    return (c.name && (c.name.formatted_name || c.name.first_name)) || '';
  }
  return '';
}

function pickAttachments(msg) {
  const attachments = [];
  for (const k of ['image', 'video', 'audio', 'document', 'sticker']) {
    const m = msg[k];
    if (m && m.id) {
      attachments.push({
        id: m.id, // Meta media_id
        type: k,
        filename: m.filename,
        mimeType: m.mime_type,
        sha256: m.sha256
      });
    }
  }
  return attachments;
}

function buildInboundMessageEvent(msg, contact, ctx) {
  const senderName = (contact && contact.profile && contact.profile.name) || null;

  const metadata = {
    originalEvent: 'messages',
    wabaId: ctx.wabaId,
    messageType: msg.type
  };
  if (msg.context) {
    metadata.contextMessageId = msg.context.id;
    metadata.contextFrom = msg.context.from;
    metadata.contextForwarded = msg.context.forwarded;
  }
  if (msg.referral) metadata.referral = msg.referral;
  if (msg.interactive) metadata.interactive = msg.interactive;
  if (msg.button) metadata.buttonPayload = msg.button.payload;
  if (msg.reaction) metadata.reaction = msg.reaction;
  if (msg.location) metadata.location = msg.location;
  if (msg.contacts) metadata.contacts = msg.contacts;
  if (msg.errors) metadata.errors = msg.errors;

  return new NormalizedEvent({
    type: EventTypes.MESSAGE_RECEIVED,
    provider: 'cloud-api',
    providerType: ProviderTypes.WHATSAPP,
    accountId: ctx.phoneNumberId,
    chatId: msg.from,
    messageId: msg.id,
    senderId: msg.from,
    senderName,
    content: pickContent(msg),
    timestamp: tsToIso(msg.timestamp),
    attachments: pickAttachments(msg),
    metadata,
    raw: msg
  });
}

function buildStatusEvent(status, ctx) {
  let type;
  switch (status.status) {
    case 'sent':
      type = EventTypes.MESSAGE_SENT;
      break;
    case 'delivered':
      type = EventTypes.MESSAGE_DELIVERED;
      break;
    case 'read':
      type = EventTypes.MESSAGE_READ;
      break;
    case 'failed':
      type = EventTypes.MESSAGE_FAILED;
      break;
    default:
      type = EventTypes.UNKNOWN;
  }

  return new NormalizedEvent({
    type,
    provider: 'cloud-api',
    providerType: ProviderTypes.WHATSAPP,
    accountId: ctx.phoneNumberId,
    chatId: status.recipient_id,
    messageId: status.id,
    timestamp: tsToIso(status.timestamp),
    metadata: {
      originalEvent: 'statuses',
      wabaId: ctx.wabaId,
      status: status.status,
      conversation: status.conversation, // pricing window info
      pricing: status.pricing,
      errors: status.errors
    },
    raw: status
  });
}

function buildTemplateStatusEvent(value, ctx) {
  return new NormalizedEvent({
    type: EventTypes.TEMPLATE_STATUS_CHANGED,
    provider: 'cloud-api',
    providerType: ProviderTypes.WHATSAPP,
    accountId: ctx.wabaId,
    timestamp: new Date().toISOString(),
    metadata: {
      originalEvent: 'message_template_status_update',
      wabaId: ctx.wabaId,
      templateId: value.message_template_id,
      templateName: value.message_template_name,
      templateLanguage: value.message_template_language,
      previousStatus: value.previous_category || value.previous_status,
      newStatus: value.event,
      reason: value.reason,
      disableInfo: value.disable_info,
      otherInfo: value.other_info
    },
    raw: ctx.raw
  });
}

function buildAccountStatusEvent(value, field, ctx) {
  return new NormalizedEvent({
    type: EventTypes.ACCOUNT_STATUS_CHANGED,
    provider: 'cloud-api',
    providerType: ProviderTypes.WHATSAPP,
    accountId: ctx.phoneNumberId || ctx.wabaId,
    timestamp: new Date().toISOString(),
    metadata: { originalEvent: field, wabaId: ctx.wabaId, ...value },
    raw: ctx.raw
  });
}

function buildErrorEvent(err, ctx) {
  return new NormalizedEvent({
    type: EventTypes.MESSAGE_FAILED,
    provider: 'cloud-api',
    providerType: ProviderTypes.WHATSAPP,
    accountId: ctx.phoneNumberId,
    timestamp: new Date().toISOString(),
    metadata: { originalEvent: 'errors', wabaId: ctx.wabaId, error: err },
    raw: err
  });
}

module.exports = {
  parseCloudApiWebhook,
  validateCloudApiSignature,
  generateWebhookJobId
};
