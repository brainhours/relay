/**
 * Uazapi Webhook Parser
 *
 * Parses Uazapi webhook payloads and normalizes them to Relay's standard
 * NormalizedEvent format. Two server flavors are supported transparently:
 *
 *   1) Classic Uazapi v2.1 (https://docs.uazapi.com/ historic schema):
 *        { event, instance, data }
 *
 *   2) uazapiGO / wuzapi-based servers (current hosted product at uazapi.com,
 *      backed by https://github.com/asternic/wuzapi). Sends:
 *        {
 *          BaseUrl, EventType, token, owner, instanceName,
 *          type,                  // wuzapi event type: Message | ReadReceipt | ...
 *          event | message | chat // payload, varies by EventType
 *        }
 *
 * `parseUazapiWebhook` detects the format from top-level keys and dispatches.
 * Both branches return the same NormalizedEvent shape; consumers don't need
 * to know which server flavor they're talking to.
 *
 * The `event` channel is broad (e.g. "messages_update" covers read, delivered,
 * edited, deleted, reaction). Each branch refines the type using payload fields.
 *
 * @see https://docs.uazapi.com/        Hosted uazapiGO docs (overview)
 * @see https://github.com/asternic/wuzapi  Underlying Go library / event names
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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Convert a numeric timestamp (s or ms) or string into ISO. Falls back to now.
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
 * Normalize a WhatsApp JID (e.g. "5511999999999@s.whatsapp.net" -> "5511999999999").
 * @private
 */
function shortSender(jid) {
  if (typeof jid !== 'string' || !jid.includes('@')) return jid;
  return jid.split('@')[0];
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * uazapiGO payloads always carry `BaseUrl` and `EventType` at the top level
 * (added by the GO-side webhook dispatcher on top of wuzapi's raw event).
 * Classic Uazapi v2.1 never sends these.
 * @private
 */
function isUazapiGoPayload(payload) {
  return !!(payload && typeof payload === 'object' && payload.BaseUrl && payload.EventType);
}

// ---------------------------------------------------------------------------
// Classic Uazapi v2.1 parser (unchanged behavior)
// ---------------------------------------------------------------------------

/**
 * Refine the event type using the message payload (classic v2.1 schema).
 * @private
 */
function resolveClassicType(eventChannel, data = {}) {
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
function extractClassicAttachments(data = {}) {
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
 * Parse a classic Uazapi v2.1 payload.
 * @private
 */
function parseClassicPayload(rawPayload) {
  const eventChannel = rawPayload.event || 'unknown';
  const data = rawPayload.data || {};
  const accountId = rawPayload.instance || data.owner || data.instance;

  const type = resolveClassicType(eventChannel, data);

  const chatId = data.chatid || data.chat_id || data.jid || null;
  const messageId = data.messageid || data.id || data.msgId || null;
  const senderId = data.sender || data.from || null;

  const senderName =
    data.senderName ||
    data.pushName ||
    data.notifyName ||
    data.contactName ||
    null;

  const content = data.text ?? data.vote ?? '';

  const ts = data.messageTimestamp ?? data.timestamp ?? rawPayload.timestamp;
  const timestamp = toIso(ts);

  const attachments = extractClassicAttachments(data);

  const metadata = {
    originalEvent: eventChannel,
    schema: 'classic',
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
    connected: typeof data.connected === 'boolean' ? data.connected : undefined,
    lastDisconnect: data.lastDisconnect,
    lastDisconnectReason: data.lastDisconnectReason
  };

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

// ---------------------------------------------------------------------------
// uazapiGO / wuzapi parser
// ---------------------------------------------------------------------------

/**
 * Extract the human-readable content from a uazapiGO message envelope.
 * Tries every common field name wuzapi/uazapiGO has used across versions.
 * @private
 */
function extractGoContent(msg = {}, chat = {}) {
  return (
    msg.text ??
    msg.Text ??
    msg.body ??
    msg.Body ??
    msg.conversation ??
    msg.Conversation ??
    msg.caption ??
    msg.Caption ??
    msg.Message ??
    chat.wa_lastMessageTextVote ??
    chat.lastMessageText ??
    ''
  );
}

/**
 * Resolve sender display name preferring saved names over push names.
 * @private
 */
function extractGoSenderName(msg = {}, chat = {}) {
  return (
    chat.lead_fullName ||
    chat.lead_name ||
    chat.wa_contactName ||
    chat.wa_name ||
    chat.name ||
    msg.pushName ||
    msg.PushName ||
    msg.notifyName ||
    msg.senderName ||
    null
  );
}

/**
 * Best-effort attachment extraction for uazapiGO messages. Most flavors put
 * media URLs in fields like `mediaUrl`, `image`, `video`, `document`, etc.
 * @private
 */
function extractGoAttachments(msg = {}) {
  const out = [];

  const candidates = [
    msg.image,
    msg.Image,
    msg.video,
    msg.Video,
    msg.audio,
    msg.Audio,
    msg.document,
    msg.Document,
    msg.sticker,
    msg.Sticker
  ].filter(Boolean);

  for (const c of candidates) {
    const url = c.url || c.URL || c.mediaUrl || c.directPath || c.fileUrl;
    if (!url && !c.mediaKey) continue;
    out.push({
      id: c.id || c.mediaKey,
      filename: c.fileName || c.filename || c.title,
      mimeType: c.mimetype || c.mime_type || c.mimeType,
      size: c.fileLength || c.fileSize || c.size,
      url
    });
  }

  // Inline `mediaUrl` directly on msg
  if (!out.length && msg.mediaUrl) {
    out.push({
      id: msg.id || msg.MessageID,
      filename: msg.fileName || msg.filename,
      mimeType: msg.mimetype || msg.mimeType,
      url: msg.mediaUrl
    });
  }

  return out;
}

/**
 * Parse a `messages` event from uazapiGO (a new incoming or outgoing message).
 * Payload shape:
 *   { EventType: "messages", token, owner, instanceName, message: {...}, chat: {...} }
 * @private
 */
function parseGoMessageEvent(body) {
  const m = body.message || {};
  const c = body.chat || {};

  const isFromMe = !!(m.IsFromMe ?? m.fromMe ?? m.key?.fromMe);

  const rawChatJid = c.wa_chatid || m.Chat || m.chatid || m.key?.remoteJid;
  const chatId = shortSender(rawChatJid);

  const messageId =
    m.id || m.Id || m.ID || m.MessageID || m.messageid || m.key?.id || null;

  const rawSender = m.Sender || m.sender || m.participant || rawChatJid;
  const senderId = shortSender(rawSender);

  const content = extractGoContent(m, c);

  const timestamp = toIso(
    m.messageTimestamp ??
    m.timestamp ??
    m.Timestamp ??
    c.wa_lastMsgTimestamp ??
    body.timestamp
  );

  const attachments = extractGoAttachments(m);

  return new NormalizedEvent({
    type: isFromMe ? EventTypes.MESSAGE_SENT : EventTypes.MESSAGE_RECEIVED,
    provider: 'uazapi',
    providerType: ProviderTypes.WHATSAPP,
    accountId: body.token,
    chatId,
    messageId,
    senderId,
    senderName: extractGoSenderName(m, c),
    content,
    timestamp,
    attachments,
    metadata: {
      originalEvent: 'messages',
      schema: 'uazapiGO',
      fromMe: isFromMe,
      isGroup: !!(c.wa_isGroup ?? m.IsGroup),
      messageType: m.Type || m.messageType || c.wa_lastMessageType,
      ownerPhone: body.owner,
      instanceName: body.instanceName,
      wuzapiType: body.type,
      senderShort: senderId
    },
    raw: body
  });
}

/**
 * Parse a `messages_update` event (read receipt, edit, delete, reaction).
 * Payload shape:
 *   { EventType: "messages_update", token, state: "Read"|"Delivered"|...,
 *     type: "ReadReceipt", event: { MessageIDs, Sender, Chat, Type, ... } }
 * @private
 */
function parseGoMessagesUpdateEvent(body) {
  const ev = body.event || {};
  const state = String(body.state || ev.Type || ev.type || '').toLowerCase();

  let type = EventTypes.UNKNOWN;
  if (state === 'read') type = EventTypes.MESSAGE_READ;
  else if (state === 'delivered' || state === 'delivery') type = EventTypes.MESSAGE_DELIVERED;
  else if (state === 'played') type = EventTypes.MESSAGE_READ;
  else if (state === 'failed' || state === 'error') type = EventTypes.MESSAGE_FAILED;
  else if (state === 'sent') type = EventTypes.MESSAGE_SENT;
  else if (state === 'deleted') type = EventTypes.MESSAGE_DELETED;
  else if (state === 'edited') type = EventTypes.MESSAGE_EDITED;
  else if (ev.reaction) type = EventTypes.MESSAGE_REACTION;

  // messages_update can carry multiple message IDs in one event. We surface
  // the first as the canonical messageId and the full list under metadata so
  // consumers can fan out if they need to.
  const messageIds = Array.isArray(ev.MessageIDs) ? ev.MessageIDs : [];
  const messageId = messageIds[0] || ev.id || ev.ID || null;

  return new NormalizedEvent({
    type,
    provider: 'uazapi',
    providerType: ProviderTypes.WHATSAPP,
    accountId: body.token,
    chatId: shortSender(ev.Chat || ev.chatid),
    messageId,
    senderId: shortSender(ev.Sender || ev.sender_pn),
    senderName: null,
    content: '',
    timestamp: toIso(ev.Timestamp ?? body.timestamp),
    attachments: [],
    metadata: {
      originalEvent: 'messages_update',
      schema: 'uazapiGO',
      state,
      wuzapiType: body.type,
      messageIds,
      fromMe: !!ev.IsFromMe,
      isGroup: !!ev.IsGroup,
      ownerPhone: body.owner,
      instanceName: body.instanceName
    },
    raw: body
  });
}

/**
 * Parse a `connection` event (instance status change).
 * @private
 */
function parseGoConnectionEvent(body) {
  const ev = body.event || {};
  const status = String(body.state || ev.State || ev.status || body.type || '').toLowerCase();
  const isConnected = status === 'connected' || status === 'open' || status === 'online';
  const isDisconnected = status === 'disconnected' || status === 'logged_out' || status === 'closed';

  let type;
  if (isConnected) type = EventTypes.ACCOUNT_CONNECTED;
  else if (isDisconnected) type = EventTypes.ACCOUNT_DISCONNECTED;
  else type = EventTypes.ACCOUNT_STATUS_CHANGED;

  return new NormalizedEvent({
    type,
    provider: 'uazapi',
    providerType: ProviderTypes.WHATSAPP,
    accountId: body.token,
    chatId: null,
    messageId: null,
    senderId: null,
    senderName: null,
    content: '',
    timestamp: toIso(body.timestamp),
    attachments: [],
    metadata: {
      originalEvent: 'connection',
      schema: 'uazapiGO',
      connectionStatus: isConnected ? 'connected' : (isDisconnected ? 'disconnected' : status),
      connected: isConnected ? true : (isDisconnected ? false : undefined),
      profileName: body.instanceName,
      phoneNumber: body.owner,
      ownerPhone: body.owner,
      instanceName: body.instanceName,
      wuzapiType: body.type
    },
    raw: body
  });
}

/**
 * Parse a uazapiGO payload by dispatching on `EventType`.
 * @private
 */
function parseGoPayload(rawPayload) {
  const channel = String(rawPayload.EventType || '').toLowerCase();

  switch (channel) {
    case 'messages':
      return parseGoMessageEvent(rawPayload);

    case 'messages_update':
      return parseGoMessagesUpdateEvent(rawPayload);

    case 'connection':
      return parseGoConnectionEvent(rawPayload);

    default:
      return new NormalizedEvent({
        type: EventTypes.UNKNOWN,
        provider: 'uazapi',
        providerType: ProviderTypes.WHATSAPP,
        accountId: rawPayload.token,
        chatId: null,
        messageId: null,
        senderId: null,
        senderName: null,
        content: '',
        timestamp: toIso(rawPayload.timestamp),
        attachments: [],
        metadata: {
          originalEvent: channel,
          schema: 'uazapiGO',
          wuzapiType: rawPayload.type,
          ownerPhone: rawPayload.owner,
          instanceName: rawPayload.instanceName
        },
        raw: rawPayload
      });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw Uazapi webhook into a NormalizedEvent.
 *
 * Auto-detects classic v2.1 vs uazapiGO (wuzapi) format from top-level keys.
 *
 * @param {Object} rawPayload - Raw webhook payload from Uazapi
 * @returns {NormalizedEvent}
 */
function parseUazapiWebhook(rawPayload = {}) {
  if (isUazapiGoPayload(rawPayload)) {
    return parseGoPayload(rawPayload);
  }
  return parseClassicPayload(rawPayload);
}

/**
 * Validate a Uazapi webhook signature.
 *
 * Neither classic Uazapi v2.1 nor uazapiGO documents an HMAC signature header
 * in their default config. The recommended hardening is to embed a secret in
 * the webhook URL (e.g. `?secret=<random>`) and verify it in the route handler.
 *
 * wuzapi-based servers can be configured to send `x-hmac-signature`; future
 * versions of this function may validate that header when present.
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
