/**
 * Uazapi Messaging Manager
 *
 * Send/edit/delete messages and lightweight presence/read updates.
 * Field names follow the Uazapi spec verbatim (e.g., `replyid`, `track_source`)
 * so consumers can paste payloads from the docs without translation.
 *
 * Endpoints (all POST, header `token`):
 *   /send/text          - text
 *   /send/media         - image/video/audio/document/sticker/ptt/...
 *   /send/contact       - vCard
 *   /send/location      - lat/lng
 *   /send/menu          - button/list/poll/carousel
 *   /message/react      - reactions (text='' removes)
 *   /message/edit       - edit
 *   /message/delete     - "delete for all"
 *   /message/markread   - mark read (array of ids)
 *   /message/presence   - typing/recording/paused
 */

const { BaseMessagingManager } = require('../base');

/** Pick only the keys that are not undefined. Keeps payloads clean. */
function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class UazapiMessagingManager extends BaseMessagingManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  /**
   * Send a plain text message.
   *
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.serverId]
   * @param {string} params.number    - phone or chat ID (5511..., @g.us, @s.whatsapp.net, @lid, @newsletter)
   * @param {string} params.text
   * @param {string} [params.replyid]
   * @param {string} [params.mentions]      - comma-separated numbers
   * @param {boolean} [params.linkPreview]
   * @param {string} [params.linkPreviewTitle]
   * @param {string} [params.linkPreviewDescription]
   * @param {string} [params.linkPreviewImage]
   * @param {boolean} [params.linkPreviewLarge]
   * @param {boolean} [params.readchat]
   * @param {boolean} [params.readmessages]
   * @param {number} [params.delay]
   * @param {boolean} [params.forward]
   * @param {string} [params.track_source]
   * @param {string} [params.track_id]
   * @param {boolean} [params.async]
   * @returns {Promise<Object>}
   */
  async sendText({
    token,
    serverId,
    number,
    text,
    replyid,
    mentions,
    linkPreview,
    linkPreviewTitle,
    linkPreviewDescription,
    linkPreviewImage,
    linkPreviewLarge,
    readchat,
    readmessages,
    delay,
    forward,
    track_source,
    track_id,
    async: asyncFlag
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/send/text',
      token,
      serverId,
      data: omitUndef({
        number,
        text,
        replyid,
        mentions,
        linkPreview,
        linkPreviewTitle,
        linkPreviewDescription,
        linkPreviewImage,
        linkPreviewLarge,
        readchat,
        readmessages,
        delay,
        forward,
        track_source,
        track_id,
        async: asyncFlag
      })
    });
  }

  /**
   * Send a media message. `file` may be a public URL or base64.
   *
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.serverId]
   * @param {string} params.number
   * @param {string} params.type   - 'image'|'video'|'videoplay'|'document'|'audio'|'myaudio'|'ptt'|'ptv'|'sticker'
   * @param {string} params.file   - URL or base64
   * @param {string} [params.text] - caption
   * @param {string} [params.docName]
   * @param {string} [params.mimetype]
   * @param {string} [params.thumbnail]
   * @param {string} [params.replyid]
   * @param {string} [params.mentions]
   * @param {boolean} [params.readchat]
   * @param {boolean} [params.readmessages]
   * @param {number} [params.delay]
   * @param {boolean} [params.forward]
   * @param {string} [params.track_source]
   * @param {string} [params.track_id]
   * @param {boolean} [params.async]
   * @param {boolean} [params.viewOnce]
   * @returns {Promise<Object>}
   */
  async sendMedia({
    token,
    serverId,
    number,
    type,
    file,
    text,
    docName,
    mimetype,
    thumbnail,
    replyid,
    mentions,
    readchat,
    readmessages,
    delay,
    forward,
    track_source,
    track_id,
    async: asyncFlag,
    viewOnce
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/send/media',
      token,
      serverId,
      data: omitUndef({
        number,
        type,
        file,
        text,
        docName,
        mimetype,
        thumbnail,
        replyid,
        mentions,
        readchat,
        readmessages,
        delay,
        forward,
        track_source,
        track_id,
        async: asyncFlag,
        viewOnce
      })
    });
  }

  /**
   * Send a contact (vCard).
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async sendContact({
    token,
    serverId,
    number,
    fullName,
    phoneNumber,
    organization,
    email,
    url,
    replyid,
    mentions,
    readchat,
    readmessages,
    delay,
    forward,
    track_source,
    track_id,
    async: asyncFlag
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/send/contact',
      token,
      serverId,
      data: omitUndef({
        number,
        fullName,
        phoneNumber,
        organization,
        email,
        url,
        replyid,
        mentions,
        readchat,
        readmessages,
        delay,
        forward,
        track_source,
        track_id,
        async: asyncFlag
      })
    });
  }

  /**
   * Send a location.
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async sendLocation({
    token,
    serverId,
    number,
    latitude,
    longitude,
    name,
    address,
    replyid,
    mentions,
    readchat,
    readmessages,
    delay,
    forward,
    track_source,
    track_id,
    async: asyncFlag
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/send/location',
      token,
      serverId,
      data: omitUndef({
        number,
        name,
        address,
        latitude,
        longitude,
        replyid,
        mentions,
        readchat,
        readmessages,
        delay,
        forward,
        track_source,
        track_id,
        async: asyncFlag
      })
    });
  }

  /**
   * Send an interactive menu (button/list/poll/carousel).
   *
   * @param {Object} params
   * @param {string} params.type    - 'button' | 'list' | 'poll' | 'carousel'
   * @param {string} params.text
   * @param {string[]} params.choices
   * @param {string} [params.footerText]
   * @param {string} [params.listButton]
   * @param {number} [params.selectableCount]
   * @param {string} [params.imageButton]
   * @returns {Promise<Object>}
   */
  async sendMenu({
    token,
    serverId,
    number,
    type,
    text,
    choices,
    footerText,
    listButton,
    selectableCount,
    imageButton,
    replyid,
    mentions,
    readchat,
    readmessages,
    delay,
    track_source,
    track_id,
    async: asyncFlag
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/send/menu',
      token,
      serverId,
      data: omitUndef({
        number,
        type,
        text,
        choices,
        footerText,
        listButton,
        selectableCount,
        imageButton,
        replyid,
        mentions,
        readchat,
        readmessages,
        delay,
        track_source,
        track_id,
        async: asyncFlag
      })
    });
  }

  /**
   * Send a reaction to a message.
   * @param {Object} params
   * @param {string} params.number  - chat ID
   * @param {string} params.id      - target message ID
   * @param {string} params.text    - emoji (empty string removes the reaction)
   * @returns {Promise<Object>}
   */
  async react({ token, serverId, number, id, text } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/react',
      token,
      serverId,
      data: { number, id, text }
    });
  }

  /**
   * Edit a previously-sent message.
   * @param {Object} params
   * @param {string} params.id    - message ID (with or without owner prefix)
   * @param {string} params.text
   * @returns {Promise<Object>}
   */
  async edit({ token, serverId, id, text } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/edit',
      token,
      serverId,
      data: { id, text }
    });
  }

  /**
   * Delete a message for everyone.
   * @param {Object} params
   * @param {string} params.id
   * @returns {Promise<Object>}
   */
  async delete({ token, serverId, id } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/delete',
      token,
      serverId,
      data: { id }
    });
  }

  /**
   * Mark messages as read.
   *
   * @param {Object} params
   * @param {string|string[]} params.id - message ID(s)
   * @returns {Promise<Object>}
   */
  async markRead({ token, serverId, id } = {}) {
    const ids = Array.isArray(id) ? id : [id];
    return this.provider.request({
      method: 'POST',
      path: '/message/markread',
      token,
      serverId,
      data: { id: ids }
    });
  }

  /**
   * Send a presence update to a chat (typing/recording/paused).
   *
   * @param {Object} params
   * @param {string} params.number
   * @param {'composing'|'recording'|'paused'} params.presence
   * @param {number} [params.delay]    - duration in ms (max 300000)
   * @returns {Promise<Object>}
   */
  async sendPresence({ token, serverId, number, presence, delay } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/presence',
      token,
      serverId,
      data: omitUndef({ number, presence, delay })
    });
  }

  /**
   * Pin or unpin a message.
   * @param {Object} params
   * @param {string} params.id      - message ID
   * @param {boolean} params.pin    - true to pin, false to unpin
   * @param {number} [params.duration] - seconds (24h, 7d, 30d typically)
   * @returns {Promise<Object>}
   */
  async pin({ token, serverId, id, pin, duration } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/pin',
      token,
      serverId,
      data: omitUndef({ id, pin, duration })
    });
  }

  /**
   * Download the binary content of a media message.
   * @param {Object} params
   * @param {string} params.id - message ID
   * @returns {Promise<Object>}
   */
  async download({ token, serverId, id } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/download',
      token,
      serverId,
      data: { id }
    });
  }

  // ---- BaseMessagingManager contract ----

  /**
   * Generic adapter to BaseMessagingManager.sendMessage(). Maps to /send/text.
   * Accepts both `chat_id` (Relay convention) and `number` (Uazapi convention).
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async sendMessage(params = {}) {
    const { chat_id, ...rest } = params;
    return this.sendText({ number: chat_id ?? rest.number, ...rest });
  }

  /** Alias matching BaseMessagingManager.send(). */
  async send(params = {}) {
    return this.sendMessage(params);
  }
}

module.exports = { UazapiMessagingManager };
