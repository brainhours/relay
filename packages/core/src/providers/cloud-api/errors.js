/**
 * MetaApiError — typed error for Meta Graph API responses.
 *
 * Cloud API errors look like:
 *   {
 *     "error": {
 *       "message": "...",
 *       "type": "OAuthException",
 *       "code": 131026,
 *       "error_subcode": 2494102,
 *       "error_data": { "details": "..." },
 *       "fbtrace_id": "..."
 *     }
 *   }
 *
 * The error preserves all those fields so apps can branch on metaCode without
 * parsing strings. META_ERROR_CODES gives names to the codes apps usually
 * react to. The list is NOT exhaustive — Meta documents ~80 codes; we
 * surface only the ones with frequent business meaning.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */

const META_ERROR_CODES = Object.freeze({
  // Authorization / quota / generic
  RATE_LIMIT: 4,
  TOO_MANY_API_CALLS: 80007,
  AUTH_INVALID: 190,
  PERMISSION_DENIED: 200,
  PARAM_VALUE_INVALID: 100,

  // Phone / recipient
  PHONE_NOT_ON_WHATSAPP: 131026,
  RECIPIENT_BLOCKED: 131045,
  USER_OPTED_OUT: 130472,
  WINDOW_EXPIRED: 131047,

  // Message content / format
  MESSAGE_TOO_LONG: 131009,
  MESSAGE_UNDELIVERABLE: 131053,
  MEDIA_DOWNLOAD_FAILED: 131053,

  // Templates
  TEMPLATE_NOT_APPROVED: 132001,
  TEMPLATE_PARAM_COUNT_MISMATCH: 132000,
  TEMPLATE_LANGUAGE_MISSING: 132005,
  TEMPLATE_PAUSED: 132007,
  TEMPLATE_DISABLED: 132015,
  TEMPLATE_NOT_EXIST: 132012
});

class MetaApiError extends Error {
  /**
   * @param {Object} input
   * @param {number} input.statusCode
   * @param {number} [input.metaCode]
   * @param {number} [input.metaSubcode]
   * @param {string} [input.metaTitle]
   * @param {Object} [input.metaDetails]
   * @param {string} [input.metaTraceId]
   * @param {*}      [input.body]
   */
  constructor({
    statusCode,
    metaCode,
    metaSubcode,
    metaTitle,
    metaDetails,
    metaTraceId,
    body
  } = {}) {
    super(metaTitle || `Meta API error (status ${statusCode})`);
    this.name = 'MetaApiError';
    this.statusCode = statusCode;
    this.metaCode = metaCode;
    this.metaSubcode = metaSubcode;
    this.metaTitle = metaTitle;
    this.metaDetails = metaDetails;
    this.metaTraceId = metaTraceId;
    this.body = body;
  }

  /**
   * Build from an axios error.
   * @param {Error & { response?: any }} err
   * @returns {MetaApiError}
   */
  static fromAxiosError(err) {
    if (err && err.response) {
      const data = err.response.data || {};
      const e = data.error || {};
      return new MetaApiError({
        statusCode: err.response.status,
        metaCode: e.code,
        metaSubcode: e.error_subcode,
        metaTitle: e.message || err.message,
        metaDetails: e.error_data,
        metaTraceId:
          (err.response.headers && (err.response.headers['x-fb-trace-id'] || err.response.headers['x-fb-debug'])) ||
          e.fbtrace_id,
        body: data
      });
    }
    // Network / unknown error
    return new MetaApiError({
      statusCode: 0,
      metaTitle: err && err.message ? err.message : 'Network error',
      body: null
    });
  }

  /**
   * Whether this error is worth retrying. Apps making their own retry policy
   * can use this as a hint, but it's just a hint — final decision is theirs.
   *
   * Retryable: rate limit, throttling, transient 5xx.
   * NOT retryable: auth invalid, perm denied, template not approved, opt-out, etc.
   *
   * @returns {boolean}
   */
  isRetryable() {
    if (this.statusCode >= 500 && this.statusCode < 600) return true;
    if (this.metaCode === META_ERROR_CODES.RATE_LIMIT) return true;
    if (this.metaCode === META_ERROR_CODES.TOO_MANY_API_CALLS) return true;
    return false;
  }

  /**
   * Plain object representation for logging.
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      metaCode: this.metaCode,
      metaSubcode: this.metaSubcode,
      metaTitle: this.metaTitle,
      metaDetails: this.metaDetails,
      metaTraceId: this.metaTraceId
    };
  }
}

/** Standalone helper, for code that doesn't want to call err.isRetryable(). */
function isRetryable(err) {
  if (err instanceof MetaApiError) return err.isRetryable();
  return false;
}

module.exports = { MetaApiError, META_ERROR_CODES, isRetryable };
