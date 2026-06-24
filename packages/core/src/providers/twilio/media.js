/**
 * Twilio media manager.
 *
 * Media in Twilio is attached to a Message (inbound MMS/WhatsApp media, or media
 * you sent). It is NOT uploaded ahead of time like Meta Cloud API — to SEND
 * media you just pass a public `mediaUrl` to `messaging.send`. This manager is
 * about READING media off existing messages:
 *
 *   - list      : GET the Media subresource list of a message
 *   - getInfo   : metadata for one Media instance (content_type, sid, ...)
 *   - download  : fetch the actual bytes (follows Twilio's 302 to the CDN)
 *   - delete    : delete a stored Media instance
 *
 * The binary lives at the Media URL WITHOUT the `.json` suffix; Twilio responds
 * with a 302 redirect to a (pre-signed) CDN URL. axios follows it. Basic auth is
 * sent to api.twilio.com; the redirect target is pre-signed so it needs none —
 * follow-redirects drops the Authorization header on the cross-host hop.
 */

class TwilioMediaManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * List the media attached to a message.
   * @param {Object} params
   * @param {string} params.messageSid
   * @param {number} [params.pageSize=50]
   * @returns {Promise<{ media_list: any[], ... }>}
   */
  async list({ messageSid, pageSize = 50, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!messageSid) throw new Error('twilio.media.list: `messageSid` is required');
    return this.provider.request({
      method: 'GET',
      path: `/Messages/${messageSid}/Media.json`,
      params: { PageSize: pageSize },
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * Metadata-only for a single Media instance (no bytes).
   * @param {Object} params
   * @param {string} params.messageSid
   * @param {string} params.mediaSid
   * @returns {Promise<{ sid, content_type, ... }>}
   */
  async getInfo({ messageSid, mediaSid, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!messageSid || !mediaSid) {
      throw new Error('twilio.media.getInfo: `messageSid` and `mediaSid` are required');
    }
    return this.provider.request({
      method: 'GET',
      path: `/Messages/${messageSid}/Media/${mediaSid}.json`,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * Download media bytes. Pass either `{ messageSid, mediaSid }` (the manager
   * builds the URL) OR a direct `url` (e.g. the `MediaUrl0` from an inbound
   * webhook). Returns `{ buffer, contentType }`.
   *
   * @param {Object} params
   * @param {string} [params.messageSid]
   * @param {string} [params.mediaSid]
   * @param {string} [params.url]                     - direct media URL (with or without .json)
   * @returns {Promise<{ buffer: Buffer, contentType: string }>}
   */
  async download({ messageSid, mediaSid, url, accountSid, authToken, apiKeySid, apiKeySecret }) {
    let absoluteUrl = url;
    if (!absoluteUrl) {
      if (!messageSid || !mediaSid) {
        throw new Error('twilio.media.download: pass `url` or both `messageSid` and `mediaSid`');
      }
      const sid = accountSid || this.provider.accountSid;
      absoluteUrl = `${this.provider.baseUrl}/2010-04-01/Accounts/${sid}/Messages/${messageSid}/Media/${mediaSid}`;
    }
    // Twilio serves the binary at the URL WITHOUT `.json`. Strip it if present.
    absoluteUrl = absoluteUrl.replace(/\.json($|\?)/i, '$1');

    const response = await this.provider.request({
      method: 'GET',
      absoluteUrl,
      responseType: 'arraybuffer',
      headers: { Accept: '*/*' },
      returnResponse: true,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });

    return {
      buffer: Buffer.from(response.data),
      contentType: response.headers && (response.headers['content-type'] || response.headers['Content-Type'])
    };
  }

  /**
   * Delete a stored Media instance.
   * @param {Object} params
   * @param {string} params.messageSid
   * @param {string} params.mediaSid
   */
  async delete({ messageSid, mediaSid, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!messageSid || !mediaSid) {
      throw new Error('twilio.media.delete: `messageSid` and `mediaSid` are required');
    }
    return this.provider.request({
      method: 'DELETE',
      path: `/Messages/${messageSid}/Media/${mediaSid}.json`,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }
}

module.exports = { TwilioMediaManager };
