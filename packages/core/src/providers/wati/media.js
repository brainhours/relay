/**
 * Wati Media Manager
 *
 * Wati message media lives on the tenant's server and requires the Bearer token
 * to download — it is not a public link. The file path (`fileName`) comes in the
 * `data` field of each item from `conversations.getMessages` (e.g.
 * 'data/images/uuid.jpg'). This fetches the bytes.
 *
 * @see https://docs.wati.io/   (GET /api/v1/getMedia?fileName=...)
 */

class WatiMediaManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Downloads a media file by the path returned from getMessages.
   *
   * @param {Object} params
   * @param {string} params.fileName        - path from getMessages `data`
   *                                           (e.g. 'data/images/uuid.jpg'; a
   *                                           leading '/' is tolerated).
   * @param {number} [params.maxBytes]       - size cap (bytes).
   * @returns {Promise<{ buffer: Buffer, mimeType: string|null }>}
   */
  async getMedia({ apiEndpoint, accessToken, fileName, maxBytes } = {}) {
    if (!fileName) throw new Error('Wati.media.getMedia: fileName is required');
    // getMessages sometimes returns the path with a leading '/'; the API rejects it.
    const normalized = String(fileName).replace(/^\/+/, '');

    const res = await this.provider.request({
      method: 'GET',
      path: '/api/v1/getMedia',
      apiEndpoint,
      accessToken,
      params: { fileName: normalized },
      responseType: 'arraybuffer',
      maxContentLength: maxBytes
    });

    return { buffer: res.buffer, mimeType: res.contentType };
  }
}

module.exports = { WatiMediaManager };
