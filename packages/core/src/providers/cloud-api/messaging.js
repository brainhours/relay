/**
 * Meta WhatsApp Cloud API messaging manager.
 *
 * All methods POST to `/{phoneNumberId}/messages` with different `type`
 * payloads. The `to` field is E.164 without leading `+`. Caller passes
 * `accessToken` and `phoneNumberId` per-call (multi-tenant routing).
 *
 * Coverage:
 *   - sendTemplate           — outside the 24h window, OK any time
 *   - sendText               — only inside 24h window
 *   - sendInteractive        — buttons, list, cta_url, location_request, flow
 *   - sendMedia              — image, video, audio, document, sticker (mediaId or link)
 *   - sendLocation
 *   - sendContacts
 *   - sendReaction
 *   - markRead
 *
 * `contextMessageId` enables reply-to-context (Meta's "reply" UI).
 */

const { BaseMessagingManager } = require('../base');

/** @internal — strip undefined keys to keep payloads tidy. */
function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class MetaCloudApiMessagingManager extends BaseMessagingManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  /**
   * Send an HSM template. Required for any first-touch / outside-24h-window send.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   * @param {string} params.to                       - E.164 without '+'
   * @param {string} params.templateName
   * @param {string} params.language                 - e.g. 'pt_BR'
   * @param {Array}  [params.components]             - parameters array per Meta schema
   * @param {string} [params.contextMessageId]       - reply-to-context
   * @param {string} [params.bizOpaqueCallbackData]  - opaque blob echoed back in webhook
   * @returns {Promise<{ messages: { id: string }[], contacts?: any[] }>}
   */
  async sendTemplate({
    accessToken,
    phoneNumberId,
    to,
    templateName,
    language,
    components,
    contextMessageId,
    bizOpaqueCallbackData
  }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: omitUndef({
          name: templateName,
          language: { code: language },
          components
        }),
        context: contextMessageId ? { message_id: contextMessageId } : undefined,
        biz_opaque_callback_data: bizOpaqueCallbackData
      })
    });
  }

  /**
   * Send a free-form text message. ONLY allowed within the 24h customer-service
   * window. Use sendTemplate otherwise.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   * @param {string} params.to
   * @param {string} params.body
   * @param {boolean} [params.previewUrl=false]
   * @param {string} [params.contextMessageId]
   */
  async sendText({ accessToken, phoneNumberId, to, body, previewUrl, contextMessageId }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: omitUndef({ body, preview_url: previewUrl }),
        context: contextMessageId ? { message_id: contextMessageId } : undefined
      })
    });
  }

  /**
   * Send any `type=interactive` message (buttons / list / cta_url / location_request / flow).
   *
   * The `interactive` parameter is the raw Meta object — see Meta docs for shape.
   * This wrapper does not validate the shape (Meta returns clean errors when
   * malformed).
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   * @param {string} params.to
   * @param {Object} params.interactive             - { type, header?, body, footer?, action }
   * @param {string} [params.contextMessageId]
   */
  async sendInteractive({ accessToken, phoneNumberId, to, interactive, contextMessageId }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive,
        context: contextMessageId ? { message_id: contextMessageId } : undefined
      })
    });
  }

  /**
   * Send media. Either `mediaId` (uploaded via media.upload first) OR `link`
   * (publicly accessible HTTPS URL — Meta downloads it).
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   * @param {string} params.to
   * @param {'image'|'video'|'audio'|'document'|'sticker'} params.type
   * @param {string} [params.mediaId]
   * @param {string} [params.link]
   * @param {string} [params.caption]               - image/video/document only
   * @param {string} [params.filename]              - document only
   * @param {string} [params.contextMessageId]
   */
  async sendMedia({
    accessToken,
    phoneNumberId,
    to,
    type,
    mediaId,
    link,
    caption,
    filename,
    contextMessageId
  }) {
    if (!mediaId && !link) {
      throw new Error('cloud-api.sendMedia: either mediaId or link is required');
    }
    const mediaPayload = omitUndef({
      id: mediaId,
      link,
      caption: type === 'audio' || type === 'sticker' ? undefined : caption,
      filename: type === 'document' ? filename : undefined
    });
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type,
        [type]: mediaPayload,
        context: contextMessageId ? { message_id: contextMessageId } : undefined
      })
    });
  }

  /**
   * Send a geographic location pin.
   * @param {Object} params
   * @param {number} params.latitude
   * @param {number} params.longitude
   * @param {string} [params.name]
   * @param {string} [params.address]
   */
  async sendLocation({
    accessToken,
    phoneNumberId,
    to,
    latitude,
    longitude,
    name,
    address,
    contextMessageId
  }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'location',
        location: omitUndef({ latitude, longitude, name, address }),
        context: contextMessageId ? { message_id: contextMessageId } : undefined
      })
    });
  }

  /**
   * Send a contact card.
   * @param {Object} params
   * @param {Array} params.contacts   - array of Meta contact objects
   */
  async sendContacts({ accessToken, phoneNumberId, to, contacts, contextMessageId }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'contacts',
        contacts,
        context: contextMessageId ? { message_id: contextMessageId } : undefined
      })
    });
  }

  /**
   * React to a message. Pass empty string to remove the reaction.
   * @param {Object} params
   * @param {string} params.messageId    - target message ID (Meta's wamid.*)
   * @param {string} params.emoji
   */
  async sendReaction({ accessToken, phoneNumberId, to, messageId, emoji }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'reaction',
        reaction: { message_id: messageId, emoji }
      }
    });
  }

  /**
   * Mark an inbound message as read (shows blue ticks to the sender).
   * @param {Object} params
   * @param {string} params.messageId
   * @param {Object} [params.typingIndicator]   - optional, e.g. { type: 'text' } to also show "typing"
   */
  async markRead({ accessToken, phoneNumberId, messageId, typingIndicator }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/messages`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: typingIndicator
      })
    });
  }

  // ---- BaseMessagingManager contract ----

  /** Default to template (works outside the 24h window). */
  async send(params) { return this.sendTemplate(params); }
  async sendMessage(params) { return this.sendTemplate(params); }
}

module.exports = { MetaCloudApiMessagingManager };
