/**
 * ZernioMediaManager — upload media for use in posts/messages.
 *
 * Two paths:
 *   - presign(): get a presigned URL, upload the bytes to it yourself (best for
 *     large files / browser direct-upload), then reference the returned URL in
 *     a post's mediaItems.
 *   - uploadDirect(): stream the bytes through Zernio (multipart). Pass a
 *     Node Buffer / stream plus filename + contentType, or a form-data instance.
 */
const FormData = require('form-data');

class ZernioMediaManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Request a presigned upload URL.
   * @param {Object} body - { filename, contentType, ... }
   * @returns {Promise<Object>} typically { uploadUrl, fileUrl, ... }
   */
  presign(body) {
    return this.provider.request({ method: 'POST', path: '/media/presign', data: body });
  }

  /**
   * Upload media bytes directly through Zernio (multipart/form-data).
   * @param {Object} params
   * @param {Buffer|ReadableStream} params.file        - file content
   * @param {string} [params.filename]                 - filename for the part
   * @param {string} [params.contentType]              - MIME type
   * @param {FormData} [params.formData]               - pre-built form-data (overrides file)
   * @param {Object} [params.fields]                   - extra form fields
   * @returns {Promise<Object>}
   */
  uploadDirect({ file, filename, contentType, formData, fields } = {}) {
    let form = formData;
    if (!form) {
      form = new FormData();
      const fileOpts = {};
      if (filename) fileOpts.filename = filename;
      if (contentType) fileOpts.contentType = contentType;
      form.append('file', file, fileOpts);
      for (const [k, v] of Object.entries(fields || {})) form.append(k, v);
    }
    return this.provider.request({ method: 'POST', path: '/media/upload-direct', formData: form });
  }
}

module.exports = { ZernioMediaManager };
