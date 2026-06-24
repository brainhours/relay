/**
 * TwilioApiError — typed error for Twilio REST API responses.
 *
 * Twilio errors look like:
 *   {
 *     "code": 21211,
 *     "message": "The 'To' number +1 is not a valid phone number.",
 *     "more_info": "https://www.twilio.com/docs/errors/21211",
 *     "status": 400
 *   }
 *
 * The error preserves all those fields so apps can branch on `twilioCode`
 * without parsing strings. TWILIO_ERROR_CODES gives names to the codes apps
 * usually react to. The list is NOT exhaustive — Twilio documents hundreds of
 * codes; we surface only the ones with frequent business meaning.
 *
 * NOTE: many delivery problems do NOT surface as API errors — they arrive
 * asynchronously on the status-callback webhook as `ErrorCode` on an
 * `undelivered`/`failed` status (e.g. 30007 carrier-filtered, 63016 WhatsApp
 * freeform outside the 24h window). Those codes are also listed below so the
 * same map covers both the synchronous and the webhook path.
 *
 * @see https://www.twilio.com/docs/api/errors
 */

const TWILIO_ERROR_CODES = Object.freeze({
  // Authentication / authorization / quota (synchronous API errors)
  AUTHENTICATION_ERROR: 20003,
  PERMISSION_DENIED: 20005,
  RESOURCE_NOT_FOUND: 20404,
  TOO_MANY_REQUESTS: 20429,

  // Bad request — recipient / sender / content (synchronous API errors)
  INVALID_TO_NUMBER: 21211,
  INVALID_FROM_NUMBER: 21212,
  FROM_NOT_OWNED: 21606,
  FROM_SMS_INCAPABLE: 21606,
  TO_NOT_MOBILE: 21614,
  REGION_NOT_ENABLED: 21408,
  BLOCKED_AS_SPAM: 21610, // recipient unsubscribed (STOP)
  MEDIA_NOT_FOUND: 21620,
  BODY_REQUIRED: 21602,
  MESSAGE_BODY_TOO_LARGE: 21617,

  // WhatsApp-specific (synchronous + webhook)
  WHATSAPP_FREEFORM_OUTSIDE_WINDOW: 63016, // must send an approved template
  WHATSAPP_TEMPLATE_NOT_APPROVED: 63005,
  WHATSAPP_CHANNEL_NOT_FOUND: 63003,
  WHATSAPP_NO_SENDER: 63007,
  WHATSAPP_RATE_LIMIT: 63018,
  WHATSAPP_RECIPIENT_OPTED_OUT: 63024,

  // Asynchronous delivery failures (status-callback ErrorCode, not API errors)
  QUEUE_OVERFLOW: 30001,
  ACCOUNT_SUSPENDED: 30002,
  UNREACHABLE_HANDSET: 30003,
  MESSAGE_BLOCKED: 30004,
  UNKNOWN_DESTINATION: 30005,
  LANDLINE_UNREACHABLE: 30006,
  CARRIER_FILTERED: 30007,
  DELIVERY_UNKNOWN: 30008
});

class TwilioApiError extends Error {
  /**
   * @param {Object} input
   * @param {number} input.statusCode            - HTTP status
   * @param {number} [input.twilioCode]          - Twilio numeric `code`
   * @param {string} [input.twilioMessage]       - Twilio `message`
   * @param {string} [input.moreInfo]            - Twilio `more_info` URL
   * @param {*}      [input.body]                - raw response body
   */
  constructor({ statusCode, twilioCode, twilioMessage, moreInfo, body } = {}) {
    super(twilioMessage || `Twilio API error (status ${statusCode})`);
    this.name = 'TwilioApiError';
    this.statusCode = statusCode;
    this.twilioCode = twilioCode;
    this.twilioMessage = twilioMessage;
    this.moreInfo = moreInfo;
    this.body = body;
  }

  /**
   * Build from an axios error.
   * @param {Error & { response?: any }} err
   * @returns {TwilioApiError}
   */
  static fromAxiosError(err) {
    if (err && err.response) {
      const data = err.response.data || {};
      return new TwilioApiError({
        statusCode: err.response.status,
        twilioCode: data.code,
        twilioMessage: data.message || err.message,
        moreInfo: data.more_info,
        body: data
      });
    }
    // Network / unknown error
    return new TwilioApiError({
      statusCode: 0,
      twilioMessage: err && err.message ? err.message : 'Network error',
      body: null
    });
  }

  /**
   * Whether this error is worth retrying. Apps making their own retry policy
   * can use this as a hint, but it's just a hint — final decision is theirs.
   *
   * Retryable: HTTP 429 / Twilio 20429 (rate limit), transient 5xx, WhatsApp
   * rate limit (63018). NOT retryable: auth, invalid number, opt-out, template
   * not approved, freeform-outside-window, etc.
   *
   * @returns {boolean}
   */
  isRetryable() {
    if (this.statusCode >= 500 && this.statusCode < 600) return true;
    if (this.statusCode === 429) return true;
    if (this.twilioCode === TWILIO_ERROR_CODES.TOO_MANY_REQUESTS) return true;
    if (this.twilioCode === TWILIO_ERROR_CODES.WHATSAPP_RATE_LIMIT) return true;
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
      twilioCode: this.twilioCode,
      twilioMessage: this.twilioMessage,
      moreInfo: this.moreInfo
    };
  }
}

/** Standalone helper, for code that doesn't want to call err.isRetryable(). */
function isRetryable(err) {
  if (err instanceof TwilioApiError) return err.isRetryable();
  return false;
}

module.exports = { TwilioApiError, TWILIO_ERROR_CODES, isRetryable };
