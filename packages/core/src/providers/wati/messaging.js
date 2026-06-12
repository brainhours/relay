/**
 * Wati Messaging Manager
 *
 * Outbound messaging against the Wati WhatsApp Business API. Field names follow
 * the Wati spec verbatim so consumers can paste payloads from the docs.
 *
 * Endpoints (header `Authorization: Bearer <token>`):
 *   POST /api/v1/sendSessionMessage/{whatsappNumber}      - free-form text (24h window)
 *   POST /api/v1/sendSessionFileViaUrl/{whatsappNumber}   - media via public URL (24h window)
 *   POST /api/v1/sendTemplateMessage?whatsappNumber=...   - approved template (any time)
 *
 * IMPORTANT — the 24h customer-care window:
 *   sendSessionMessage / sendSessionFileViaUrl only work when there is an OPEN
 *   session (the customer messaged within the last 24h). Outside that window
 *   Wati rejects them; only sendTemplate (an approved template) is allowed.
 *   The consumer is responsible for choosing which to call.
 *
 * `localMessageId`: pass your own UUID on every send so the resulting
 * `sessionMessageSent_v2` webhook echo can be matched and de-duplicated (this is
 * how the consumer tells "the bot's own send" apart from a human operator's
 * reply typed in the Wati inbox).
 *
 * @see https://docs.wati.io/reference/post_api-v1-sendsessionmessage-whatsappnumber-1
 * @see https://docs.wati.io/reference/post_api-v1-sendtemplatemessage-1
 * @see https://docs.wati.io/reference/post_api-v1-sendsessionfileviaurl-whatsappnumber-1
 */

const { BaseMessagingManager } = require('../base');

/** Pick only the keys that are not undefined. Keeps query/body clean. */
function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  }
  return out;
}

/** Strip a leading '+' and any non-digits from a WhatsApp number. */
function cleanNumber(number) {
  return String(number ?? '').replace(/[^\d]/g, '');
}

class WatiMessagingManager extends BaseMessagingManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  /**
   * Send a free-form text message into an open 24h session.
   *
   * The text is passed as the `messageText` QUERY parameter (Wati quirk — not a
   * JSON body). The number goes in the path.
   *
   * @param {Object} params
   * @param {string} [params.apiEndpoint]
   * @param {string} [params.accessToken]
   * @param {string} params.number              - recipient WhatsApp number (country code, no '+')
   * @param {string} params.text                - message body (<=4096 chars)
   * @param {string} [params.replyContextId]    - WhatsApp message ID to reply to
   * @param {string} [params.channelPhoneNumber]- sending channel number (multi-number tenants)
   * @param {string} [params.localMessageId]    - client-provided id for echo dedup
   * @returns {Promise<Object>}
   */
  async sendText({
    apiEndpoint,
    accessToken,
    number,
    text,
    replyContextId,
    channelPhoneNumber,
    localMessageId
  } = {}) {
    const wa = cleanNumber(number);
    return this.provider.request({
      method: 'POST',
      path: `/api/v1/sendSessionMessage/${encodeURIComponent(wa)}`,
      apiEndpoint,
      accessToken,
      params: omitUndef({
        messageText: text,
        replyContextId,
        channelPhoneNumber,
        localMessageId
      })
    });
  }

  /**
   * Send a media message (image/audio/video/document) via a public URL into an
   * open 24h session.
   *
   * @param {Object} params
   * @param {string} [params.apiEndpoint]
   * @param {string} [params.accessToken]
   * @param {string} params.number
   * @param {string} params.fileUrl             - public URL of the media
   * @param {string} [params.caption]
   * @param {string} [params.channelPhoneNumber]
   * @returns {Promise<Object>}
   */
  async sendFileViaUrl({
    apiEndpoint,
    accessToken,
    number,
    fileUrl,
    caption,
    channelPhoneNumber
  } = {}) {
    const wa = cleanNumber(number);
    return this.provider.request({
      method: 'POST',
      path: `/api/v1/sendSessionFileViaUrl/${encodeURIComponent(wa)}`,
      apiEndpoint,
      accessToken,
      params: omitUndef({ fileUrl, caption, channelPhoneNumber })
    });
  }

  /**
   * Send an approved WhatsApp template (works any time, including outside the
   * 24h window — the only way to (re)open a conversation).
   *
   * @param {Object} params
   * @param {string} [params.apiEndpoint]
   * @param {string} [params.accessToken]
   * @param {string} params.number
   * @param {string} params.templateName        - approved template name
   * @param {string} [params.broadcastName]     - analytics label (no delivery effect)
   * @param {string} [params.channelNumber]     - route via a specific WABA number
   * @param {Array<{name:string,value:string}>} [params.parameters] - template placeholders
   * @returns {Promise<Object>}
   */
  async sendTemplate({
    apiEndpoint,
    accessToken,
    number,
    templateName,
    broadcastName,
    channelNumber,
    parameters
  } = {}) {
    const wa = cleanNumber(number);
    return this.provider.request({
      method: 'POST',
      path: '/api/v1/sendTemplateMessage',
      apiEndpoint,
      accessToken,
      params: { whatsappNumber: wa },
      data: omitUndef({
        template_name: templateName,
        broadcast_name: broadcastName || templateName,
        channel_number: channelNumber,
        parameters: Array.isArray(parameters) ? parameters : []
      })
    });
  }

  // ---- BaseMessagingManager contract ----

  /**
   * Generic adapter to BaseMessagingManager.sendMessage(). Maps to sendText.
   * Accepts both `chat_id` (Relay convention) and `number` (Wati convention).
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async sendMessage(params = {}) {
    const { chat_id, text, content, ...rest } = params;
    return this.sendText({
      number: chat_id ?? rest.number,
      text: text ?? content,
      ...rest
    });
  }

  /** Alias matching BaseMessagingManager.send(). */
  async send(params = {}) {
    return this.sendMessage(params);
  }
}

module.exports = { WatiMessagingManager };
