/**
 * Uazapi Webhook Parser
 *
 * Parses Uazapi webhook payloads and normalizes them to Relay's standard
 * NormalizedEvent format.
 *
 * Uazapi delivers events in the form:
 *   {
 *     "event": "messages" | "messages_update" | "connection" | ...,
 *     "instance": "<instance-id>",
 *     "data": { ...payload }
 *   }
 *
 * The `event` channel is broad (e.g. "messages_update" covers read, delivered,
 * edited, deleted, reaction). This parser refines the type using fields inside
 * `data` (`fromMe`, `status`, `connected`, `edited`, `deleted`, `reaction`).
 *
 * @see https://docs.uazapi.com/  ->  /webhook and WebhookEvent schema
 */

const { EventTypes, NormalizedEvent, ProviderTypes } = require('../../events/types');

/**
 * Mapping of Uazapi event channels to "best base" normalized event types.
 * Refinement happens in parseUazapiWebhook based on payload fields.
 */
const UAZAPI_EVENT_MAP = {
  messages: EventTypes.MESSAGE_RECEIVED,             // refined by data.fromMe
  messages_update: EventTypes.UNKNOWN,               // refined by data.status / edited / deleted
  newsletter_messages: EventTypes.MESSAGE_RECEIVED,
  connection: EventTypes.ACCOUNT_STATUS_CHANGED,     // refined by data.connected
  presence: EventTypes.UNKNOWN,
  groups: EventTypes.UNKNOWN,
  contacts: EventTypes.RELATION_CREATED,             // closest match in current taxonomy
  chats: EventTypes.UNKNOWN,
  call: EventTypes.UNKNOWN,
  labels: EventTypes.UNKNOWN,
  blocks: EventTypes.UNKNOWN,
  sender: EventTypes.UNKNOWN,
  chat_labels: EventTypes.UNKNOWN,
  history: EventTypes.UNKNOWN
};

/**
 * Refine the event type using the message payload.
 * @private
 */
function resolveType(eventChannel, data = {}) {
  const base = UAZAPI_EVENT_MAP[eventChannel] ?? EventTypes.UNKNOWN;

  if (eventChannel === 'messages') {
    return data.fromMe ? EventTypes.MESSAGE_SENT : EventTypes.MESSAGE_RECEIVED;
  }

  if (eventChannel === 'messages_update') {
    if (data.reaction) return EventTypes.MESSAGE_REACTION;
    if (data.edited) return EventTypes.MESSAGE_EDITED;
    if (data.deleted || data.status === 'Deleted') return EventTypes.MESSAGE_DELETED;
    if (data.status === 'Read') return EventTypes.MESSAGE_READ;
    if (data.status === 'Delivered') return EventTypes.MESSAGE_DELIVERED;
    return EventTypes.UNKNOWN;
  }

  if (eventChannel === 'connection') {
    if (data.connected === true) return EventTypes.ACCOUNT_CONNECTED;
    if (data.connected === false) return EventTypes.ACCOUNT_DISCONNECTED;
    return EventTypes.ACCOUNT_STATUS_CHANGED;
  }

  return base;
}

/**
 * Extract attachment metadata from Uazapi `data.content`. Uazapi serializes the
 * raw WhatsApp message into `content` (object or JSON string). When media is
 * present, useful keys are: url, mimetype, fileName, fileLength, mediaKey.
 * @private
 */
function extractAttachments(data = {}) {
  let content = data.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      content = null;
    }
  }
  if (!content || typeof content !== 'object') return [];

  // Walk one level: WhatsApp messages nest media under e.g. imageMessage,
  // videoMessage, documentMessage, audioMessage, stickerMessage.
  const attachments = [];

  const candidates = [
    content,
    content.imageMessage,
    content.videoMessage,
    content.documentMessage,
    content.audioMessage,
    content.stickerMessage
  ].filter(Boolean);

  for (const c of candidates) {
    const url = c.url || c.directPath || c.fileUrl || c.mediaUrl;
    if (!url && !c.mediaKey) continue;
    attachments.push({
      id: c.id || c.mediaKey,
      filename: c.fileName || c.filename || c.title,
      mimeType: c.mimetype || c.mime_type,
      size: c.fileLength || c.fileSize || c.size,
      url
    });
  }

  return attachments;
}

/**
 * Normalize a sender ID (e.g. "5511999999999@s.whatsapp.net" -> "5511999999999").
 * @private
 */
function shortSender(jid) {
  if (typeof jid !== 'string' || !jid.includes('@')) return jid;
  return jid.split('@')[0];
}

/**
 * Parse a raw Uazapi webhook into a NormalizedEvent.
 *
 * @param {Object} rawPayload - Raw webhook payload from Uazapi
 * @returns {NormalizedEvent}
 */
function parseUazapiWebhook(rawPayload = {}) {
  const eventChannel = rawPayload.event || 'unknown';
  const data = rawPayload.data || {};
  const accountId = rawPayload.instance || data.owner || data.instance;

  const type = resolveType(eventChannel, data);

  const chatId = data.chatid || data.chat_id || data.jid || null;
  const messageId = data.messageid || data.id || data.msgId || null;
  const senderId = data.sender || data.from || null;

  // Resolve a display name preferring saved names, then the WhatsApp push name
  const senderName =
    data.senderName ||
    data.pushName ||
    data.notifyName ||
    data.contactName ||
    null;

  // Content: text or vote (poll). Reactions ride on `reaction` and don't have body.
  const content = data.text ?? data.vote ?? '';

  // Timestamp: messageTimestamp is ms since epoch (per spec)
  const ts = data.messageTimestamp ?? data.timestamp ?? rawPayload.timestamp;
  const timestamp = ts
    ? new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts).toISOString()
    : new Date().toISOString();

  const attachments = extractAttachments(data);

  const metadata = {
    originalEvent: eventChannel,
    isGroup: !!data.isGroup,
    fromMe: !!data.fromMe,
    messageType: data.messageType,
    status: data.status,
    wasSentByApi: !!data.wasSentByApi,
    quoted: data.quoted || undefined,
    reaction: data.reaction || undefined,
    edited: data.edited || undefined,
    senderShort: shortSender(senderId),
    source: data.source,
    // For connection events, surface key fields
    connected: typeof data.connected === 'boolean' ? data.connected : undefined,
    lastDisconnect: data.lastDisconnect,
    lastDisconnectReason: data.lastDisconnectReason
  };

  // Drop undefined keys to keep metadata tidy
  for (const k of Object.keys(metadata)) {
    if (metadata[k] === undefined) delete metadata[k];
  }

  return new NormalizedEvent({
    type,
    provider: 'uazapi',
    providerType: ProviderTypes.WHATSAPP,
    accountId,
    chatId,
    messageId,
    senderId,
    senderName,
    content,
    timestamp,
    attachments,
    metadata,
    raw: rawPayload
  });
}

/**
 * Validate a Uazapi webhook signature.
 *
 * Uazapi does not document an HMAC signature header in v2.1.0 of the spec.
 * The recommended hardening is to use a secret in the webhook URL itself
 * (e.g. https://app.com/webhooks/uazapi?secret=<random>) and verify it in
 * your route handler.
 *
 * This function exists for symmetry with other providers and returns `true`
 * unless a future signature scheme is adopted upstream.
 *
 * @param {Object} _payload
 * @param {string} _signature
 * @param {string} _secret
 * @returns {boolean}
 */
function validateUazapiSignature(_payload, _signature, _secret) {
  return true;
}

/**
 * Generate a deterministic job ID for webhook deduplication (Bull queue).
 *
 * @param {NormalizedEvent} event
 * @returns {string}
 */
function generateWebhookJobId(event) {
  const parts = [
    'uazapi',
    event.type,
    event.accountId,
    event.messageId || event.chatId || event.timestamp
  ].filter(Boolean);
  return parts.join(':');
}

module.exports = {
  parseUazapiWebhook,
  validateUazapiSignature,
  generateWebhookJobId,
  UAZAPI_EVENT_MAP
};
