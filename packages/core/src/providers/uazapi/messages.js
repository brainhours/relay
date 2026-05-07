/**
 * Uazapi Messages Manager
 *
 * Search, download and history-sync endpoints (read-only against existing chats).
 *
 * Endpoints:
 *   POST /message/find          - search messages in a chat
 *   POST /message/download      - download media binary or get URL/base64
 *   POST /message/history-sync  - request historical messages on demand
 */

function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class UazapiMessagesManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Find messages in a chat or by ID/track fields.
   * @param {Object} params
   * @param {string} [params.id]
   * @param {string} [params.chatid]
   * @param {string} [params.track_source]
   * @param {string} [params.track_id]
   * @param {number} [params.limit]
   * @param {number} [params.offset]
   * @returns {Promise<Object>}
   */
  async find({ token, serverId, id, chatid, track_source, track_id, limit, offset } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/find',
      token,
      serverId,
      data: omitUndef({ id, chatid, track_source, track_id, limit, offset })
    });
  }

  /**
   * Download media of a message. Use one of:
   *   - return_link=true  -> server-stored public URL (default)
   *   - return_base64=true -> inline base64
   *
   * @param {Object} params
   * @param {string} params.id
   * @param {boolean} [params.return_base64]
   * @param {boolean} [params.generate_mp3]
   * @param {boolean} [params.return_link]
   * @param {boolean} [params.transcribe]
   * @param {string}  [params.openai_apikey]
   * @param {boolean} [params.download_quoted]
   * @returns {Promise<Object>}
   */
  async download({
    token,
    serverId,
    id,
    return_base64,
    generate_mp3,
    return_link,
    transcribe,
    openai_apikey,
    download_quoted
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/download',
      token,
      serverId,
      data: omitUndef({
        id,
        return_base64,
        generate_mp3,
        return_link,
        transcribe,
        openai_apikey,
        download_quoted
      })
    });
  }

  /**
   * Request historical messages for a chat (by anchor) or refetch one exact message.
   *
   * @param {Object} params
   * @param {string} params.number    - JID of the chat
   * @param {'history'|'exact'} [params.mode='history']
   * @param {string} [params.messageid]
   * @param {number} [params.count]
   * @returns {Promise<Object>}
   */
  async historySync({ token, serverId, number, mode, messageid, count } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/message/history-sync',
      token,
      serverId,
      data: omitUndef({ number, mode, messageid, count })
    });
  }
}

module.exports = { UazapiMessagesManager };
