/**
 * WebchatMessagingManager — outbound messages (agent or AI → visitor).
 *
 * Inbound messages (visitor → app) are handled by createWebchatHandler at the
 * /:widgetKey/message endpoint. Use this manager from your application code
 * when a human agent or AI bot wants to push a message to a visitor's widget.
 *
 * The manager mirrors the BaseMessagingManager surface so handlers can be
 * provider-agnostic: `webchat.messaging.sendMessage({ chat_id, text })`
 * mirrors Unipile/Uazapi.
 */

const { BaseMessagingManager } = require('../base');
const { parseWebchatWebhook } = require('./webhooks');

class WebchatMessagingManager extends BaseMessagingManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  /**
   * Send a message from the agent/AI side to the visitor.
   *
   * @param {Object} params
   * @param {string} params.conversationId
   * @param {string} params.accountId
   * @param {string} params.content
   * @param {'user'|'ai'} [params.senderType='user']
   * @returns {Promise<Object>} the persisted message
   */
  async sendMessage({
    conversationId,
    accountId,
    content,
    senderType = 'user'
  } = {}) {
    if (!conversationId) throw new Error('webchat.sendMessage: conversationId is required');
    if (!accountId) throw new Error('webchat.sendMessage: accountId is required');
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('webchat.sendMessage: content is required');
    }
    if (senderType !== 'user' && senderType !== 'ai') {
      throw new Error("webchat.sendMessage: senderType must be 'user' or 'ai'");
    }

    const { storage, realtime, emitter } = this.provider;

    // 1. Persist
    const message = await storage.insertMessage({
      conversationId,
      accountId,
      senderType,
      content,
      providerType: 'WEBCHAT'
    });

    // 2. Update conversation summary
    await storage.updateConversationOnNewMessage(conversationId, {
      lastPreview: content.slice(0, 200),
      lastAt: message.sent_at,
      fromVisitor: false
    });

    // 3. Realtime fan-out (best effort)
    if (realtime && realtime.isAvailable()) {
      try {
        await realtime.publish(`conversation:${conversationId}`, 'new_message', {
          conversationId,
          message
        });
        await realtime.publish(`account:${accountId}`, 'conversation_updated', {
          conversationId,
          last_message_preview: content.slice(0, 200),
          last_message_at: message.sent_at
        });
      } catch {
        // Realtime is best-effort — persistence already succeeded
      }
    }

    // 4. Emit MESSAGE_SENT on the relay emitter (symmetry with Unipile/Uazapi).
    //    Handlers wanting to listen for outbound visitor messages can filter
    //    on event.providerType === 'WEBCHAT' && event.metadata.senderType ∈ {user, ai}.
    if (emitter) {
      const event = parseWebchatWebhook({
        widgetKey: undefined,                 // not known at outbound time
        accountId,
        channelId: undefined,
        conversationId,
        messageId: message.id,
        senderType,
        content,
        sentAt: message.sent_at
      });
      try {
        await emitter.emit(event);
      } catch {
        // emitter handler errors must not break message sending
      }
    }

    return message;
  }

  /** Alias matching BaseMessagingManager. Accepts `chat_id` (Relay convention). */
  async send(params = {}) {
    const { chat_id, text, ...rest } = params;
    return this.sendMessage({
      conversationId: params.conversationId ?? chat_id,
      content: params.content ?? text,
      ...rest
    });
  }

  /** Alias for send(). */
  async sendText(params = {}) {
    return this.send(params);
  }
}

module.exports = { WebchatMessagingManager };
