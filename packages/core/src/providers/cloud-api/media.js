/**
 * Meta WhatsApp Cloud API media manager.
 *
 * Media operations:
 *   - upload    : 2-step upload (small files only, ≤100MB depending on type).
 *                 Returns `{ id }` valid ~30 days.
 *   - download  : 2-step download. GET /{id} → { url, mime_type, sha256 },
 *                 then GET {url} with Bearer token (URL expires ~5min).
 *   - getInfo   : metadata only, no bytes.
 *   - delete    : invalidate the media_id at Meta.
 *
 * For uploads >10MB, Meta has a separate Resumable Upload API not covered
 * here — out of scope for v1.10.0.
 */

const axios = require('axios');
const FormData = require('form-data');

class MetaCloudApiMediaManager {
  constructor(provider) { this.provider = provider; }

  /**
   * Upload media to Meta. Returns `{ id }` to be used in messaging.sendMedia({ mediaId }).
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   * @param {Buffer} params.buffer
   * @param {string} params.mimeType            - e.g. 'image/jpeg'
   * @param {string} [params.filename]
   * @returns {Promise<{ id: string }>}
   */
  async upload({ accessToken, phoneNumberId, buffer, mimeType, filename }) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('cloud-api.media.upload: buffer must be a Buffer');
    }
    if (!mimeType) {
      throw new Error('cloud-api.media.upload: mimeType is required');
    }
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);
    formData.append('file', buffer, {
      contentType: mimeType,
      filename: filename || 'upload'
    });

    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/media`,
      formData,
      accessToken
    });
  }

  /**
   * Download a media file in two steps:
   *   1. GET /{mediaId} → { url, mime_type, sha256, file_size }
   *   2. GET {url} (with Bearer auth) → bytes
   *
   * The signed URL expires within ~5 minutes; do not store it.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.mediaId
   * @returns {Promise<{ buffer: Buffer, mimeType: string, sha256?: string, fileSize?: number }>}
   */
  async download({ accessToken, mediaId }) {
    const meta = await this.provider.request({
      method: 'GET',
      path: `/${mediaId}`,
      accessToken
    });

    if (!meta || !meta.url) {
      throw new Error(`cloud-api.media.download: no url returned for media ${mediaId}`);
    }

    // The CDN URL is signed; we still need to send Bearer auth.
    const fileResp = await axios({
      method: 'GET',
      url: meta.url,
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
      timeout: this.provider.timeout
    });

    return {
      buffer: Buffer.from(fileResp.data),
      mimeType: meta.mime_type,
      sha256: meta.sha256,
      fileSize: meta.file_size
    };
  }

  /**
   * Metadata-only: returns Meta's media info without downloading the bytes.
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.mediaId
   */
  async getInfo({ accessToken, mediaId }) {
    return this.provider.request({
      method: 'GET',
      path: `/${mediaId}`,
      accessToken
    });
  }

  /**
   * Invalidate a media_id at Meta. Use after the file is no longer needed
   * (e.g., your app keeps its own copy and wants to free Meta's storage).
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.mediaId
   */
  async delete({ accessToken, mediaId }) {
    return this.provider.request({
      method: 'DELETE',
      path: `/${mediaId}`,
      accessToken
    });
  }
}

module.exports = { MetaCloudApiMediaManager };
