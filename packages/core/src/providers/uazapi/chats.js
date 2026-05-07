/**
 * Uazapi Chats Manager
 *
 * Endpoints (all POST, header `token`):
 *   /chat/find       - filter + paginated search
 *   /chat/archive    - archive / unarchive
 *   /chat/mute       - mute (8h | 168h | -1 permanent | 0 unmute)
 *   /chat/pin        - pin / unpin
 *   /chat/read       - mark read / unread
 *   /chat/details    - full chat info (incl. profile pic)
 *   /chat/check      - check whether numbers exist on WhatsApp
 *   /chat/delete     - delete from DB and/or from WhatsApp
 */

function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class UazapiChatsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Find chats with filters and pagination.
   *
   * Filters use the field names from the Uazapi spec verbatim
   * (`wa_chatid`, `wa_isGroup`, `wa_label`, `lead_status`, etc.).
   *
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.serverId]
   * @param {'AND'|'OR'} [params.operator]
   * @param {string} [params.sort]    - e.g. '-wa_lastMsgTimestamp'
   * @param {number} [params.limit]
   * @param {number} [params.offset]
   * @param {Object} [params.filters] - any of the wa_/lead_ filter fields
   * @returns {Promise<Object>}
   */
  async find({ token, serverId, operator, sort, limit, offset, filters = {} } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/find',
      token,
      serverId,
      data: omitUndef({ operator, sort, limit, offset, ...filters })
    });
  }

  /**
   * @param {Object} params
   * @param {string} params.number
   * @param {boolean} params.archive
   * @returns {Promise<Object>}
   */
  async archive({ token, serverId, number, archive } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/archive',
      token,
      serverId,
      data: { number, archive }
    });
  }

  /**
   * Mute or unmute a chat.
   * @param {Object} params
   * @param {string} params.number
   * @param {0|8|168|-1} params.muteEndTime   - 0 unmute, 8h, 168h (1w), -1 permanent
   * @returns {Promise<Object>}
   */
  async mute({ token, serverId, number, muteEndTime } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/mute',
      token,
      serverId,
      data: { number, muteEndTime }
    });
  }

  /**
   * @param {Object} params
   * @param {string} params.number
   * @param {boolean} params.pin
   * @returns {Promise<Object>}
   */
  async pin({ token, serverId, number, pin } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/pin',
      token,
      serverId,
      data: { number, pin }
    });
  }

  /**
   * @param {Object} params
   * @param {string} params.number
   * @param {boolean} params.read
   * @returns {Promise<Object>}
   */
  async read({ token, serverId, number, read } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/read',
      token,
      serverId,
      data: { number, read }
    });
  }

  /**
   * Get full chat details (incl. profile picture).
   * @param {Object} params
   * @param {string} params.number
   * @param {boolean} [params.preview=false]   - true returns smaller picture
   * @returns {Promise<Object>}
   */
  async details({ token, serverId, number, preview } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/details',
      token,
      serverId,
      data: omitUndef({ number, preview })
    });
  }

  /**
   * Check whether numbers exist on WhatsApp.
   * @param {Object} params
   * @param {string[]} params.numbers
   * @returns {Promise<Object>}
   */
  async check({ token, serverId, numbers } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/check',
      token,
      serverId,
      data: { numbers }
    });
  }

  /**
   * Delete chat (DB and/or WhatsApp side, with granular flags).
   * @param {Object} params
   * @param {string} params.number
   * @param {boolean} [params.deleteChatDB]
   * @param {boolean} [params.deleteMessagesDB]
   * @param {boolean} [params.deleteChatWhatsApp]
   * @param {boolean} [params.clearChatWhatsApp]
   * @returns {Promise<Object>}
   */
  async delete({
    token,
    serverId,
    number,
    deleteChatDB,
    deleteMessagesDB,
    deleteChatWhatsApp,
    clearChatWhatsApp
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/chat/delete',
      token,
      serverId,
      data: omitUndef({
        number,
        deleteChatDB,
        deleteMessagesDB,
        deleteChatWhatsApp,
        clearChatWhatsApp
      })
    });
  }
}

module.exports = { UazapiChatsManager };
