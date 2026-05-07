/**
 * Webchat webhook parser
 *
 * Webchat is unique among Relay providers: there is no external service
 * sending us webhooks. Instead, the http handler factory (or the agent-side
 * messaging manager) builds a payload after persisting a message and feeds
 * it to `parseWebchatWebhook`, which returns a `NormalizedEvent` to be
 * dispatched on the same emitter that handles Unipile and Uazapi events.
 *
 * Apps may also call this directly if they receive webchat events from
 * another source (e.g. a worker reprocessing historical messages).
 */

const { EventTypes, NormalizedEvent, ProviderTypes } = require('../../events/types');

/**
 * Build a NormalizedEvent from a webchat message payload.
 *
 * @param {Object} payload
 * @param {string} payload.widgetKey
 * @param {string} payload.accountId
 * @param {string} payload.channelId
 * @param {string} payload.conversationId
 * @param {string} payload.messageId
 * @param {'lead'|'user'|'ai'} payload.senderType   - 'lead' = visitor; 'user'/'ai' = agent-side
 * @param {string} payload.content
 * @param {string} [payload.sentAt]                 - ISO timestamp; defaults to now
 * @param {boolean} [payload.isResume]              - true if this is the first message of a resumed session
 * @param {Object} [payload.visitor]
 * @param {string} [payload.visitor.id]
 * @param {string} [payload.visitor.token]
 * @param {string} [payload.visitor.name]
 * @param {string} [payload.visitor.email]
 * @param {string} [payload.visitor.phone]
 * @param {string} [payload.visitor.contactId]
 * @param {Object} [payload.visitor.metadata]       - { ip, userAgent, referrer, pageUrl }
 * @returns {NormalizedEvent}
 */
function parseWebchatWebhook(payload = {}) {
  const visitor = payload.visitor || {};
  const isFromVisitor = payload.senderType === 'lead';

  let type;
  if (isFromVisitor) {
    type = EventTypes.MESSAGE_RECEIVED;
  } else if (payload.senderType === 'ai' || payload.senderType === 'user') {
    type = EventTypes.MESSAGE_SENT;
  } else {
    type = EventTypes.UNKNOWN;
  }

  const ts = payload.sentAt
    ? new Date(payload.sentAt).toISOString()
    : new Date().toISOString();

  const metadata = {
    originalEvent: 'message',
    widgetKey: payload.widgetKey,
    channelId: payload.channelId,
    senderType: payload.senderType,
    isResume: !!payload.isResume,
    visitorToken: visitor.token,
    visitorEmail: visitor.email,
    visitorPhone: visitor.phone,
    contactId: visitor.contactId,
    pageUrl: visitor.metadata?.pageUrl,
    referrer: visitor.metadata?.referrer,
    userAgent: visitor.metadata?.userAgent,
    ip: visitor.metadata?.ip
  };

  // Drop undefined keys to keep metadata tidy
  for (const k of Object.keys(metadata)) {
    if (metadata[k] === undefined) delete metadata[k];
  }

  return new NormalizedEvent({
    type,
    provider: 'webchat',
    providerType: ProviderTypes.WEBCHAT,
    accountId: payload.accountId,
    chatId: payload.conversationId,
    messageId: payload.messageId,
    senderId: visitor.id || null,
    senderName: visitor.name || null,
    content: payload.content || '',
    timestamp: ts,
    attachments: [],
    metadata,
    raw: payload
  });
}

/**
 * Webchat does not use HMAC signatures. The security model is:
 *   - origin check (CORS via channel.allowed_origins)
 *   - per-visitor token validated against storage on every request
 *   - rate limiting per IP
 *
 * This function exists for symmetry with other providers and always
 * returns true.
 */
function validateWebchatSignature(/* payload, signature, secret */) {
  return true;
}

/**
 * Deterministic job ID for Bull queue deduplication.
 * @param {NormalizedEvent} event
 * @returns {string}
 */
function generateWebhookJobId(event) {
  const parts = [
    'webchat',
    event.type,
    event.accountId,
    event.messageId || event.timestamp
  ].filter(Boolean);
  return parts.join(':');
}

module.exports = {
  parseWebchatWebhook,
  validateWebchatSignature,
  generateWebhookJobId
};
