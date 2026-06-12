/**
 * Wati Webhook Parser
 *
 * Normalizes Wati webhook payloads to Relay's standard NormalizedEvent format.
 *
 * Wati dispatches one event per webhook with an `eventType` discriminator:
 *
 *   message                  - inbound message from the customer (owner=false)
 *                              OR an operator message typed in the inbox (owner=true)
 *   sessionMessageSent(_v2)  - an outbound session (free-form) message was sent
 *   templateMessageSent(_v2) - an outbound template message was sent
 *   templateMessageFailed    - an outbound template failed
 *   (delivery/read/replied status events also arrive; refined via statusString)
 *
 * THE KEY SIGNAL — `owner`:
 *   owner=false  => the CUSTOMER sent it           -> MESSAGE_RECEIVED (wake the agent)
 *   owner=true   => the BUSINESS side sent it       -> MESSAGE_SENT
 *
 * Distinguishing the bot's own send from a HUMAN operator's reply (both owner=true)
 * is a POLICY decision left to the consumer, not the parser. We surface every
 * signal it needs in `metadata`:
 *   - localMessageId          : present & matching one WE generated => our own echo (dedupe)
 *   - chatbotTriggeredEventId : non-null => Wati chatbot-triggered (not a human)
 *   - operatorEmail/Name      : the operator the chat is attributed to
 *   - owner                   : business vs customer
 * The consumer compares localMessageId against its outbox and, failing that,
 * treats an owner=true message as a human takeover (pause AI).
 *
 * @see https://docs.wati.io/reference/message-received
 * @see https://docs.wati.io/reference/session-message-sent
 * @see https://docs.wati.io/reference/template-message-sent
 */

const { EventTypes, NormalizedEvent, ProviderTypes } = require('../../events/types');

/**
 * Base mapping of Wati `eventType` -> "best base" normalized type. Refinement
 * (owner / statusString) happens in parseWatiWebhook.
 */
const WATI_EVENT_MAP = {
  message: EventTypes.MESSAGE_RECEIVED,            // refined by owner
  sessionmessagesent: EventTypes.MESSAGE_SENT,
  sessionmessagesent_v2: EventTypes.MESSAGE_SENT,
  templatemessagesent: EventTypes.MESSAGE_SENT,
  templatemessagesent_v2: EventTypes.MESSAGE_SENT,
  templatemessagefailed: EventTypes.MESSAGE_FAILED,
  templatemessagefailed_v2: EventTypes.MESSAGE_FAILED
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Wati timestamp (unix seconds as string/number, or ISO) to ISO.
 * @private
 */
function toIso(ts) {
  if (ts == null || ts === '') return new Date().toISOString();
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (Number.isFinite(n)) {
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Refine the normalized type from the raw eventType + payload fields.
 * @private
 */
function resolveType(eventType, p) {
  const key = String(eventType || '').toLowerCase();
  const base = WATI_EVENT_MAP[key] ?? EventTypes.UNKNOWN;

  if (key === 'message') {
    // owner=true means the business side authored it (operator or bot echo).
    return p.owner === true ? EventTypes.MESSAGE_SENT : EventTypes.MESSAGE_RECEIVED;
  }

  // Status-only events (delivered/read/replied/failed) don't always carry a
  // distinct eventType across Wati versions — fall back to statusString.
  if (base === EventTypes.UNKNOWN) {
    const status = String(p.statusString || '').toUpperCase();
    if (status === 'DELIVERED') return EventTypes.MESSAGE_DELIVERED;
    if (status === 'READ') return EventTypes.MESSAGE_READ;
    if (status === 'FAILED') return EventTypes.MESSAGE_FAILED;
    // 'REPLIED' refers to a prior sent message getting a reply; the reply itself
    // arrives separately as a `message` event, so don't double-count it here.
  }

  return base;
}

/**
 * Extract attachment metadata for non-text inbound messages. Wati puts media
 * details under `data` (shape varies by type); we surface what's available.
 * @private
 */
function extractAttachments(p) {
  const type = String(p.type || 'text').toLowerCase();
  if (type === 'text' || type === '' || p.data == null) return [];

  let d = p.data;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch {
      // `data` may be a bare URL or filename string
      return [{
        id: p.whatsappMessageId || undefined,
        filename: undefined,
        mimeType: undefined,
        url: /^https?:\/\//i.test(d) ? d : undefined,
        watiData: d
      }];
    }
  }
  if (!d || typeof d !== 'object') return [];

  return [{
    id: d.id || p.whatsappMessageId || undefined,
    filename: d.fileName || d.filename || d.caption || undefined,
    mimeType: d.mimeType || d.mime_type || undefined,
    size: d.fileSize || d.size || undefined,
    url: d.url || d.fileUrl || d.mediaUrl || undefined,
    caption: d.caption || undefined
  }];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw Wati webhook into a NormalizedEvent.
 *
 * @param {Object} rawPayload - Raw webhook payload from Wati
 * @returns {NormalizedEvent}
 */
function parseWatiWebhook(rawPayload = {}) {
  const p = rawPayload || {};
  const eventType = p.eventType || 'unknown';
  const type = resolveType(eventType, p);

  // The customer's WhatsApp id is the conversation key on both inbound and
  // outbound events (chatId). senderId differs: customer on inbound, business on
  // outbound — but Wati only gives us waId, so we reuse it and lean on `owner`.
  const chatId = p.waId || null;
  const senderId = p.waId || null;
  const messageId = p.whatsappMessageId || p.id || null;

  // Account identity: Wati payloads don't carry a tenant id, but they do carry
  // the business channel phone number. The consumer typically resolves the
  // channel from a per-channel webhook URL/secret; channelPhoneNumber is the
  // best in-payload identifier we can offer as a fallback.
  const accountId = p.channelPhoneNumber || p.channelId || null;

  const metadata = {
    originalEvent: eventType,
    owner: p.owner === true,
    fromMe: p.owner === true,
    statusString: p.statusString,
    messageType: p.type,
    conversationId: p.conversationId,
    ticketId: p.ticketId,
    // operator attribution (assigneeId on sent events, assignedId on received)
    assignedId: p.assignedId ?? p.assigneeId,
    operatorName: p.operatorName,
    operatorEmail: p.operatorEmail,
    // signals for telling "our bot's own echo" apart from a human reply
    localMessageId: p.localMessageId,
    chatbotTriggeredEventId: p.chatbotTriggeredEventId,
    channelId: p.channelId,
    channelPhoneNumber: p.channelPhoneNumber,
    replyContextId: p.replyContextId || undefined,
    sourceType: p.sourceType,
    forwarded: p.forwarded === true ? true : undefined,
    // interactive replies
    listReply: p.listReply || undefined,
    buttonReply: p.buttonReply || undefined,
    interactiveButtonReply: p.interactiveButtonReply || undefined
  };

  for (const k of Object.keys(metadata)) {
    if (metadata[k] === undefined) delete metadata[k];
  }

  return new NormalizedEvent({
    type,
    provider: 'wati',
    providerType: ProviderTypes.WHATSAPP,
    accountId,
    chatId,
    messageId,
    senderId,
    // On outbound, senderName is the customer's display name (the chat is named
    // after them); leave it as-is — consumers key off `owner` for direction.
    senderName: p.senderName || null,
    content: p.text ?? '',
    timestamp: toIso(p.timestamp ?? p.created),
    attachments: extractAttachments(p),
    metadata,
    raw: rawPayload
  });
}

/**
 * Validate a Wati webhook.
 *
 * Wati v1 webhooks are not HMAC-signed by default; the documented hardening is
 * to embed a secret in the webhook URL and verify it in the route handler. When
 * a shared secret is configured we compare it against the provided signature
 * (constant-time); otherwise we accept (parity with Uazapi).
 *
 * @param {Object} _payload
 * @param {string} [signature] - value pulled from the request (e.g. URL secret)
 * @param {string} [secret]    - configured expected secret
 * @returns {boolean}
 */
function validateWatiSignature(_payload, signature, secret) {
  if (!secret) return true;
  const a = String(signature || '');
  const b = String(secret);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Generate a deterministic job ID for webhook deduplication (Bull queue).
 *
 * @param {NormalizedEvent} event
 * @returns {string}
 */
function generateWebhookJobId(event) {
  const parts = [
    'wati',
    event.type,
    event.accountId,
    event.messageId || event.chatId || event.timestamp
  ].filter(Boolean);
  return parts.join(':');
}

module.exports = {
  parseWatiWebhook,
  validateWatiSignature,
  generateWebhookJobId,
  WATI_EVENT_MAP
};
