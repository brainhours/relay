/**
 * ZernioApiError — typed error for Zernio API responses.
 *
 * Zernio errors are JSON, typically shaped as:
 *   { "error": "Human readable message", "code": "some_code", ...extra }
 * or sometimes:
 *   { "message": "...", "errors": [...] }
 *
 * The error preserves the HTTP status, the Zernio `code` (when present), the
 * message, and the full response body so apps can branch without parsing
 * strings. ZERNIO_ERROR_CODES names the HTTP statuses apps usually react to.
 *
 * @see https://docs.zernio.com/
 */

const ZERNIO_ERROR_CODES = Object.freeze({
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401, // invalid/expired API key
  PAYMENT_REQUIRED: 402, // plan limit / add-on required (e.g. inbox addon)
  FORBIDDEN: 403, // no access to profile/account, BYOK required
  NOT_FOUND: 404,
  CONFLICT: 409, // content-hash dedup (same content within 24h)
  RATE_LIMITED: 429,
  SERVER_ERROR: 500
});

class ZernioApiError extends Error {
  /**
   * @param {Object} input
   * @param {number} [input.statusCode]
   * @param {string} [input.code]
   * @param {string} [input.message]
   * @param {Object} [input.details]   - full response body
   * @param {string} [input.requestId]
   */
  constructor({ statusCode, code, message, details, requestId } = {}) {
    super(message || `Zernio API error${statusCode ? ` (HTTP ${statusCode})` : ''}`);
    this.name = 'ZernioApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** True for transient failures worth retrying (5xx, 429, network). */
  get retryable() {
    return isRetryable(this);
  }

  /**
   * Build a ZernioApiError from an axios error, preserving the response body.
   * @param {Error} err - axios error
   * @returns {ZernioApiError}
   */
  static fromAxiosError(err) {
    const res = err && err.response;
    if (!res) {
      // Network / timeout / DNS — no HTTP response.
      return new ZernioApiError({
        message: (err && err.message) || 'Zernio network error',
        code: err && err.code
      });
    }
    const body = res.data || {};
    const message =
      (body && (body.error || body.message)) ||
      (typeof body === 'string' ? body : null) ||
      `Zernio API error (HTTP ${res.status})`;
    return new ZernioApiError({
      statusCode: res.status,
      code: body && (body.code || body.errorCode),
      message,
      details: body,
      requestId: res.headers && (res.headers['x-request-id'] || res.headers['x-zernio-request-id'])
    });
  }
}

/**
 * @param {ZernioApiError|Error} err
 * @returns {boolean}
 */
function isRetryable(err) {
  if (!err) return false;
  // Network errors (no statusCode) are retryable.
  if (err.statusCode == null) return true;
  if (err.statusCode === ZERNIO_ERROR_CODES.RATE_LIMITED) return true;
  return err.statusCode >= 500;
}

module.exports = {
  ZernioApiError,
  ZERNIO_ERROR_CODES,
  isRetryable
};
