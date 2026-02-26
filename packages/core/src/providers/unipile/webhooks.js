/**
 * Unipile Webhook Parser
 * Parses Unipile webhook payloads and normalizes them to standard events
 */

const { EventTypes, NormalizedEvent } = require('../../events/types');

/**
 * Mapping of Unipile event keys to normalized event types
 */
const UNIPILE_EVENT_MAP = {
  // Account events
  'AccountStatus': EventTypes.ACCOUNT_STATUS_CHANGED,
  'AccountCreated': EventTypes.ACCOUNT_CONNECTED,
  'AccountDeleted': EventTypes.ACCOUNT_DISCONNECTED,

  // Message events
  'MessageReceived': EventTypes.MESSAGE_RECEIVED,
  'MessageSent': EventTypes.MESSAGE_SENT,
  'MessageDelivered': EventTypes.MESSAGE_DELIVERED,
  'MessageRead': EventTypes.MESSAGE_READ,
  'MessageEdited': EventTypes.MESSAGE_EDITED,
  'MessageDeleted': EventTypes.MESSAGE_DELETED,
  'MessageReaction': EventTypes.MESSAGE_REACTION,

  // Relation events
  'NewRelation': EventTypes.RELATION_CREATED,
  'RelationCreated': EventTypes.RELATION_CREATED
};

/**
 * Parse raw Unipile webhook payload
 * Unipile sends events with the type as the key: { "MessageReceived": { ... } }
 *
 * @param {Object} rawPayload - Raw webhook payload from Unipile
 * @returns {{ eventType: string, payload: Object }}
 */
function parseUnipileWebhookRaw(rawPayload) {
  // Check for event key format: { "EventType": { ... } }
  const eventKeys = Object.keys(rawPayload);

  for (const key of eventKeys) {
    if (UNIPILE_EVENT_MAP[key]) {
      const eventData = rawPayload[key];
      return {
        eventType: UNIPILE_EVENT_MAP[key],
        originalEventKey: key,
        payload: eventData
      };
    }
  }

  // Fallback: legacy format with event/type field
  const eventType = rawPayload.event || rawPayload.type;
  return {
    eventType: eventType || EventTypes.UNKNOWN,
    originalEventKey: null,
    payload: rawPayload
  };
}

/**
 * Parse Unipile webhook and return a NormalizedEvent
 *
 * @param {Object} rawPayload - Raw webhook payload from Unipile
 * @returns {NormalizedEvent}
 */
function parseUnipileWebhook(rawPayload) {
  const { eventType, originalEventKey, payload } = parseUnipileWebhookRaw(rawPayload);

  // Extract common fields
  const accountId = payload.account_id || payload.accountId || payload.account?.id;
  const chatId = payload.chat_id || payload.chatId || payload.chat?.id;
  const messageId = payload.message_id || payload.messageId || payload.id;

  // Extract sender info - LinkedIn envia em varios campos possiveis
  const sender = payload.sender || payload.from || payload.attendee || {};
  const senderId = sender.id || sender.provider_id || sender.attendee_provider_id || payload.sender_id;

  // Extrair nome do remetente - priorizar campos mais completos
  // LinkedIn pode enviar: attendee_name, display_name, name, first_name + last_name
  let senderName = sender.attendee_name
    || sender.display_name
    || sender.name
    || sender.full_name;

  // Se nao tem nome completo, tentar combinar first_name + last_name
  if (!senderName && (sender.first_name || sender.last_name)) {
    senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim();
  }

  // Fallback para pushname (WhatsApp)
  if (!senderName) {
    senderName = sender.pushname;
  }

  // Extract content
  const content = payload.text || payload.content || payload.body || payload.message;

  // Extract timestamp
  const timestamp = payload.timestamp || payload.created_at || payload.date;

  // Extract attachments
  const attachments = normalizeAttachments(payload.attachments || []);

  // Extract provider type (LINKEDIN, WHATSAPP, etc.)
  // Normalizar para UPPERCASE para consistência com ProviderTypes
  const rawProviderType = payload.provider || payload.provider_type ||
    payload.account?.provider || payload.channel_type;
  const providerType = rawProviderType ? rawProviderType.toUpperCase() : undefined;

  // Determinar direcao da mensagem (inbound = recebida do lead, outbound = enviada pelo usuario)
  // MessageReceived = inbound (lead enviou), MessageSent = outbound (usuario enviou)
  const direction = originalEventKey === 'MessageSent' ? 'outbound' : 'inbound';

  // Build metadata with provider-specific data
  const metadata = {
    originalEventKey,
    direction,
    messageType: payload.message_type,
    isGroup: payload.is_group || false,
    replyTo: payload.reply_to || payload.in_reply_to,
    reactions: payload.reactions,
    editedAt: payload.edited_at,
    deliveredAt: payload.delivered_at,
    readAt: payload.read_at,
    // Dados adicionais do sender para LinkedIn
    senderProviderId: sender.attendee_provider_id || sender.provider_id || senderId
  };

  // Add relation-specific data
  if (eventType === EventTypes.RELATION_CREATED) {
    metadata.relation = {
      userId: payload.user_id || payload.provider_id,
      profileUrl: payload.profile_url || payload.public_identifier,
      firstName: payload.first_name,
      lastName: payload.last_name,
      headline: payload.headline,
      company: payload.company
    };
  }

  return new NormalizedEvent({
    type: eventType,
    provider: 'unipile',
    providerType,
    accountId,
    chatId,
    messageId,
    senderId,
    senderName,
    content,
    timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    attachments,
    metadata,
    raw: rawPayload
  });
}

/**
 * Normalize attachments to a consistent format
 * @param {Array} attachments
 * @returns {Array}
 */
function normalizeAttachments(attachments) {
  return attachments.map(att => ({
    id: att.id || att.attachment_id,
    filename: att.filename || att.name,
    mimeType: att.mime_type || att.mimetype || att.type,
    size: att.size || att.file_size,
    url: att.url || att.file_url
  }));
}

/**
 * Validate Unipile webhook signature (if enabled)
 *
 * @param {Object} payload - Webhook payload
 * @param {string} signature - X-Unipile-Signature header
 * @param {string} secret - Webhook secret
 * @returns {boolean}
 */
function validateUnipileSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return true; // Skip validation if not configured
  }

  // Unipile uses HMAC-SHA256 for signature validation
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate a unique job ID for webhook deduplication
 *
 * @param {NormalizedEvent} event
 * @returns {string}
 */
function generateWebhookJobId(event) {
  const parts = [
    'unipile',
    event.type,
    event.accountId,
    event.messageId || event.chatId || Date.now()
  ].filter(Boolean);

  return parts.join(':');
}

module.exports = {
  parseUnipileWebhook,
  parseUnipileWebhookRaw,
  validateUnipileSignature,
  generateWebhookJobId,
  UNIPILE_EVENT_MAP
};
