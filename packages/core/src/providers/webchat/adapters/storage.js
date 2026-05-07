/**
 * WebchatStorageAdapter — abstract contract.
 *
 * The consuming app implements this against its own database (Postgres,
 * Mongo, SQLite, in-memory, ...). The Relay core never touches SQL — every
 * persistence operation goes through this interface.
 *
 * For a working zero-dependency implementation, see InMemoryWebchatStorage.
 *
 * Conventions:
 *   - All `find*` methods return `null` (not `undefined`) when nothing is found.
 *   - Optional methods (e.g. contact linking) default to no-ops in the base class.
 *   - The adapter owns visitor token generation in `createVisitor`.
 *   - All identifiers are strings (no numeric IDs).
 */

class WebchatStorageAdapter {
  // ---------------------------------------------------------------------------
  // Channel config
  // ---------------------------------------------------------------------------

  /**
   * Lookup a channel by its public widget key. Returns the full channel record
   * needed for ownership/CORS checks.
   *
   * @param {string} widgetKey
   * @returns {Promise<Object|null>} {
   *   id, account_id, allowed_origins: string[], is_active: boolean, ...config
   * }
   */
  async getChannelByWidgetKey(widgetKey) {
    throw new Error('WebchatStorageAdapter.getChannelByWidgetKey not implemented');
  }

  /**
   * Same lookup but returns only the public-safe configuration (no internal
   * IDs). Used by the widget's GET /:widgetKey/config endpoint.
   *
   * @param {string} widgetKey
   * @returns {Promise<Object|null>}
   */
  async getPublicWidgetConfig(widgetKey) {
    throw new Error('WebchatStorageAdapter.getPublicWidgetConfig not implemented');
  }

  // ---------------------------------------------------------------------------
  // Visitors
  // ---------------------------------------------------------------------------

  /**
   * Lookup a visitor by their token.
   * @param {string} visitorToken
   * @returns {Promise<Object|null>} { id, account_id, channel_id, contact_id, display_name, email, phone, metadata }
   */
  async findVisitor(visitorToken) {
    throw new Error('WebchatStorageAdapter.findVisitor not implemented');
  }

  /**
   * Create a brand-new visitor record. The adapter is responsible for
   * generating the visitor token (typically 32-byte hex).
   *
   * @param {Object} params
   * @param {string} params.accountId
   * @param {string} params.channelId
   * @param {Object} [params.profile]   - { name?, email?, phone? }
   * @param {Object} [params.metadata]  - { ip?, userAgent?, referrer?, pageUrl? }
   * @returns {Promise<Object>} the new visitor (must include `visitor_token`)
   */
  async createVisitor({ accountId, channelId, profile, metadata }) {
    throw new Error('WebchatStorageAdapter.createVisitor not implemented');
  }

  /**
   * Update visitor identity. All fields optional; pass only what changed.
   *
   * @param {string} visitorId
   * @param {Object} patch  - { name?, email?, phone?, contactId? }
   * @returns {Promise<Object>}
   */
  async updateVisitorIdentity(visitorId, patch) {
    throw new Error('WebchatStorageAdapter.updateVisitorIdentity not implemented');
  }

  /**
   * Refresh `last_seen_at` for the visitor.
   * @param {string} visitorId
   */
  async touchVisitor(visitorId) {
    throw new Error('WebchatStorageAdapter.touchVisitor not implemented');
  }

  // ---------------------------------------------------------------------------
  // Contact linking (OPTIONAL)
  //
  // If both methods return non-null results, the /identify endpoint will link
  // (or create) the contact and store the contact_id on the visitor. If they
  // return null (the default), identify only updates the visitor row.
  // ---------------------------------------------------------------------------

  async findContactByEmail(/* accountId, email */) { return null; }
  async createContact(/* accountId, profile */) { return null; }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  /**
   * Find an open (non-closed) conversation for a visitor, if any.
   * @param {string} visitorId
   * @returns {Promise<Object|null>}
   */
  async findOpenConversationForVisitor(visitorId) {
    throw new Error('WebchatStorageAdapter.findOpenConversationForVisitor not implemented');
  }

  /**
   * Create a new conversation tied to a visitor.
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createConversation({ accountId, channelId, visitorId, contactId }) {
    throw new Error('WebchatStorageAdapter.createConversation not implemented');
  }

  /**
   * Verify ownership: the visitor must own the conversation. Returns the
   * conversation if owned, otherwise null. Used in /message and /history.
   *
   * @param {string} conversationId
   * @param {string} visitorId
   * @returns {Promise<Object|null>}
   */
  async getConversationForVisitor(conversationId, visitorId) {
    throw new Error('WebchatStorageAdapter.getConversationForVisitor not implemented');
  }

  /**
   * Update the visitor's contact_id on the conversation (after identify).
   */
  async setConversationContact(conversationId, contactId) {
    throw new Error('WebchatStorageAdapter.setConversationContact not implemented');
  }

  /**
   * Update lightweight summary fields after a new message.
   *
   * @param {string} conversationId
   * @param {Object} updates
   * @param {string} updates.lastPreview
   * @param {Date|string} updates.lastAt
   * @param {boolean} updates.fromVisitor   - if true, increment unread_count
   */
  async updateConversationOnNewMessage(conversationId, updates) {
    throw new Error('WebchatStorageAdapter.updateConversationOnNewMessage not implemented');
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  /**
   * Persist a new message.
   *
   * @param {Object} params
   * @param {string} params.conversationId
   * @param {string} params.accountId
   * @param {'lead'|'user'|'ai'} params.senderType
   * @param {string} params.content
   * @param {string} [params.providerType='WEBCHAT']
   * @returns {Promise<Object>} { id, sender_type, content, sent_at, ... }
   */
  async insertMessage({ conversationId, accountId, senderType, content, providerType }) {
    throw new Error('WebchatStorageAdapter.insertMessage not implemented');
  }

  /**
   * Load the message history for a conversation.
   *
   * @param {string} conversationId
   * @param {Object} opts
   * @param {number} opts.limit
   * @param {string|Date} [opts.before]   - cursor, returns messages older than this
   * @returns {Promise<Object[]>}
   */
  async loadHistory(conversationId, opts) {
    throw new Error('WebchatStorageAdapter.loadHistory not implemented');
  }

  /** 'desc' = newest first (default), 'asc' = oldest first. */
  loadHistoryDirection() { return 'desc'; }
}

module.exports = { WebchatStorageAdapter };
