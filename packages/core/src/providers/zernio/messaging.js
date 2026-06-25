/**
 * ZernioMessagingManager — unified social inbox (DMs).
 *
 * Direct-message support spans Instagram, Facebook/Messenger, WhatsApp,
 * Telegram, Twitter/X, Reddit and Bluesky (capabilities vary by platform).
 * Every call is scoped to a connected `accountId`; conversations are addressed
 * by their platform-specific `conversationId` (the `id` from listConversations).
 *
 * Note: the inbox is a paid Zernio add-on — calls return HTTP 403 ("Inbox addon
 * required") when not enabled (surfaced as ZernioApiError statusCode 403).
 *
 * Implements the BaseMessagingManager contract (send / sendMessage /
 * getMessages / getChats).
 */
const { BaseMessagingManager } = require('../base');

class ZernioMessagingManager extends BaseMessagingManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  /** List conversations. @param {Object} [params] accountId, platform, cursor, limit, … */
  listConversations(params = {}) {
    return this.provider.request({ method: 'GET', path: '/inbox/conversations', params });
  }

  /** Fetch a single conversation. */
  getConversation(conversationId, params = {}) {
    return this.provider.request({
      method: 'GET',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}`,
      params
    });
  }

  /**
   * Start a NEW conversation (e.g. send a WhatsApp template to a phone number you
   * have no thread with yet).
   * @param {Object} body - { accountId, to/recipient, message|template, … }
   */
  createConversation(body) {
    return this.provider.request({ method: 'POST', path: '/inbox/conversations', data: body });
  }

  /**
   * List messages in a conversation (cursor-paginated).
   * @param {Object} params
   * @param {string} params.conversationId
   * @param {string} params.accountId          - REQUIRED
   * @param {number} [params.limit=100]
   * @param {string} [params.cursor]
   * @param {('asc'|'desc')} [params.sortOrder='asc']
   */
  getMessages({ conversationId, ...params } = {}) {
    return this.provider.request({
      method: 'GET',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
      params
    });
  }

  /**
   * Send a message into a conversation. Supports text, attachment, quick
   * replies, buttons, WhatsApp templates and interactive content.
   * @param {Object} params
   * @param {string} params.conversationId
   * @param {string} params.accountId          - REQUIRED
   * @param {string} [params.message]          - text
   * @param {string} [params.attachmentUrl]    - public URL of image/video/audio/file
   * @param {('image'|'video'|'audio'|'file')} [params.attachmentType]
   * @param {boolean} [params.voiceNote]       - WhatsApp PTT (audio .ogg/opus)
   * @param {Array}  [params.quickReplies]
   * @param {Array}  [params.buttons]
   * @param {Object} [params.template]         - WhatsApp template: { elements:[{name,language,components}] }
   * @param {Object} [params.interactive]      - WhatsApp interactive (list/cta_url/flow/location_request)
   * @returns {Promise<Object>}
   */
  send({ conversationId, ...body } = {}) {
    if (!conversationId) throw new Error('zernio.messaging.send: `conversationId` is required');
    if (!body.accountId) throw new Error('zernio.messaging.send: `accountId` is required');
    return this.provider.request({
      method: 'POST',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
      data: body
    });
  }

  /** Edit a previously sent message (where the platform allows). */
  editMessage({ conversationId, messageId, ...body } = {}) {
    return this.provider.request({
      method: 'PATCH',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      data: body
    });
  }

  /** Delete/unsend a message (where the platform allows). */
  deleteMessage({ conversationId, messageId, accountId } = {}) {
    return this.provider.request({
      method: 'DELETE',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      params: { accountId }
    });
  }

  /** React to a message with an emoji (WhatsApp / Telegram). */
  react({ conversationId, messageId, ...body } = {}) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions`,
      data: body
    });
  }

  /** Mark a conversation read (sends WhatsApp blue ticks on eligible accounts). */
  markRead({ conversationId, ...body } = {}) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}/read`,
      data: body
    });
  }

  /** Send a typing indicator. */
  sendTyping({ conversationId, ...body } = {}) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/conversations/${encodeURIComponent(conversationId)}/typing`,
      data: body
    });
  }

  // ── BaseMessagingManager contract ──────────────────────────────────────────────

  /** @inheritdoc */
  sendMessage(params) {
    return this.send(params);
  }

  /** @inheritdoc */
  getChats(params) {
    return this.listConversations(params);
  }
}

module.exports = { ZernioMessagingManager };
