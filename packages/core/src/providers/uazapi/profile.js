/**
 * Uazapi Profile Manager
 *
 * Update the WhatsApp profile of an instance.
 *
 * Endpoints:
 *   POST /profile/name    - change display name (max 25 chars)
 *   POST /profile/image   - change profile picture (URL, base64, or "remove")
 */

class UazapiProfileManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Change the WhatsApp profile name (max 25 chars).
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.serverId]
   * @param {string} params.name
   * @returns {Promise<Object>}
   */
  async updateName({ token, serverId, name } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/profile/name',
      token,
      serverId,
      data: { name }
    });
  }

  /**
   * Change the WhatsApp profile picture.
   *
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.serverId]
   * @param {string} params.image - URL, base64 string, or "remove"/"delete"
   * @returns {Promise<Object>}
   */
  async updateImage({ token, serverId, image } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/profile/image',
      token,
      serverId,
      data: { image }
    });
  }
}

module.exports = { UazapiProfileManager };
