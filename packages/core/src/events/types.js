/**
 * Normalized event types for all messaging providers
 * Use these constants to handle events consistently across providers
 */
const EventTypes = {
  // Message events
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_READ: 'message.read',
  MESSAGE_EDITED: 'message.edited',
  MESSAGE_DELETED: 'message.deleted',
  MESSAGE_REACTION: 'message.reaction',
  MESSAGE_FAILED: 'message.failed',

  // Social content events (e.g. Zernio: comment-to-DM funnels)
  COMMENT_RECEIVED: 'comment.received',

  // Relation/connection events
  RELATION_CREATED: 'relation.created',
  RELATION_REMOVED: 'relation.removed',

  // Account events
  ACCOUNT_CONNECTED: 'account.connected',
  ACCOUNT_DISCONNECTED: 'account.disconnected',
  ACCOUNT_STATUS_CHANGED: 'account.status_changed',

  // Template lifecycle (provider-specific support, e.g. Meta Cloud API)
  TEMPLATE_STATUS_CHANGED: 'template.status_changed',

  // Unknown/unhandled
  UNKNOWN: 'unknown'
};

/**
 * Provider types supported by Relay
 */
const ProviderTypes = {
  LINKEDIN: 'LINKEDIN',
  WHATSAPP: 'WHATSAPP',
  INSTAGRAM: 'INSTAGRAM',
  MESSENGER: 'MESSENGER',
  TELEGRAM: 'TELEGRAM',
  TWITTER: 'TWITTER',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WEBCHAT: 'WEBCHAT',
  // Social channels added with the Zernio provider (publishing + social inbox)
  FACEBOOK: 'FACEBOOK',
  TIKTOK: 'TIKTOK',
  YOUTUBE: 'YOUTUBE',
  PINTEREST: 'PINTEREST',
  REDDIT: 'REDDIT',
  BLUESKY: 'BLUESKY',
  THREADS: 'THREADS',
  GOOGLEBUSINESS: 'GOOGLEBUSINESS',
  SNAPCHAT: 'SNAPCHAT',
  DISCORD: 'DISCORD'
};

/**
 * Normalized event structure
 * All providers normalize their events to this format
 */
class NormalizedEvent {
  /**
   * @param {Object} data
   * @param {string} data.type - Event type (from EventTypes)
   * @param {string} data.provider - Provider name (e.g., 'unipile', 'twilio')
   * @param {string} [data.providerType] - Channel type (e.g., 'LINKEDIN', 'WHATSAPP')
   * @param {string} data.accountId - Provider account ID
   * @param {string} [data.chatId] - Chat/conversation ID
   * @param {string} [data.messageId] - Message ID
   * @param {string} [data.senderId] - Sender identifier
   * @param {string} [data.senderName] - Sender display name
   * @param {string} [data.content] - Message content/text
   * @param {string} [data.timestamp] - ISO timestamp
   * @param {Array} [data.attachments] - Normalized attachments
   * @param {Object} [data.metadata] - Provider-specific metadata
   * @param {Object} data.raw - Original raw payload
   */
  constructor(data) {
    this.type = data.type || EventTypes.UNKNOWN;
    this.provider = data.provider;
    this.providerType = data.providerType;
    this.accountId = data.accountId;
    this.chatId = data.chatId;
    this.messageId = data.messageId;
    this.senderId = data.senderId;
    this.senderName = data.senderName;
    this.content = data.content;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.attachments = data.attachments || [];
    this.metadata = data.metadata || {};
    this.raw = data.raw;
  }

  /**
   * Check if this is a message event
   * @returns {boolean}
   */
  isMessageEvent() {
    return this.type.startsWith('message.');
  }

  /**
   * Check if this is a relation/connection event
   * @returns {boolean}
   */
  isRelationEvent() {
    return this.type.startsWith('relation.');
  }

  /**
   * Check if this is an account event
   * @returns {boolean}
   */
  isAccountEvent() {
    return this.type.startsWith('account.');
  }

  /**
   * Check if this is a template lifecycle event (e.g. Cloud API template status change)
   * @returns {boolean}
   */
  isTemplateEvent() {
    return this.type.startsWith('template.');
  }

  /**
   * Get a unique identifier for this event (for deduplication)
   * @returns {string}
   */
  getUniqueId() {
    const parts = [
      this.provider,
      this.type,
      this.accountId,
      this.messageId || this.chatId || this.timestamp
    ].filter(Boolean);

    return parts.join(':');
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      type: this.type,
      provider: this.provider,
      providerType: this.providerType,
      accountId: this.accountId,
      chatId: this.chatId,
      messageId: this.messageId,
      senderId: this.senderId,
      senderName: this.senderName,
      content: this.content,
      timestamp: this.timestamp,
      attachments: this.attachments,
      metadata: this.metadata
    };
  }
}

module.exports = {
  EventTypes,
  ProviderTypes,
  NormalizedEvent
};
