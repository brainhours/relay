/**
 * Twilio Provider — official Twilio Programmable Messaging REST API client.
 *
 * Covers SMS, MMS and WhatsApp (Twilio's WhatsApp Business sender). One global
 * endpoint (`https://api.twilio.com/2010-04-01`); requests are scoped to an
 * Account SID embedded in the path. Multi-tenant via per-call credentials —
 * pass `accountSid` / `authToken` (or an API Key pair) on any call to override
 * the constructor defaults, which is exactly how Twilio subaccounts work.
 *
 * Auth (HTTP Basic):
 *   - username = API Key SID  (if provided) else Account SID
 *   - password = API Key Secret (if provided) else Auth Token
 *   The Account SID is ALWAYS used in the URL path regardless of which
 *   credential pair signs the request. Prefer API Keys in production — they can
 *   be rotated/scoped without touching the primary Auth Token.
 *
 * The Auth Token (not API Key) is also what signs inbound webhooks
 * (`X-Twilio-Signature`), so apps that validate webhooks must keep it around —
 * see `validateTwilioSignature`.
 *
 * @example  Send a WhatsApp message
 * const { TwilioProvider } = require('@guilhermegoulart1/relay-core');
 * const twilio = new TwilioProvider({
 *   accountSid: process.env.TWILIO_ACCOUNT_SID,
 *   authToken:  process.env.TWILIO_AUTH_TOKEN
 * });
 * await twilio.messaging.sendWhatsApp({
 *   to: '+5511999999999',
 *   from: '+14155238886',            // your WhatsApp-enabled Twilio number
 *   body: 'Olá from Relay!'
 * });
 *
 * @example  Webhook intake (form-encoded — NOT JSON)
 * const { parseTwilioWebhook, validateTwilioSignature } = require('@guilhermegoulart1/relay-core');
 * app.post('/webhooks/twilio', express.urlencoded({ extended: false }), (req, res) => {
 *   const url = `https://${req.headers.host}${req.originalUrl}`;
 *   if (!validateTwilioSignature(url, req.body, req.headers['x-twilio-signature'], authToken)) {
 *     return res.sendStatus(403);
 *   }
 *   const event = parseTwilioWebhook(req.body);
 *   emitter.emit(event);
 *   res.type('text/xml').send('<Response/>');   // empty TwiML
 * });
 *
 * @see https://www.twilio.com/docs/messaging/api/message-resource
 */

const axios = require('axios');
const { BaseProvider } = require('../base');
const { TwilioApiError } = require('./errors');
const { TwilioMessagingManager } = require('./messaging');
const { TwilioMediaManager } = require('./media');
const { TwilioAccountManager } = require('./account');
const { toChannelAddress, parseChannelAddress } = require('./addresses');

const DEFAULT_BASE_URL = 'https://api.twilio.com';
const API_VERSION = '2010-04-01';

/**
 * @typedef {Object} TwilioConfig
 * @property {string} [accountSid]   - Default Account SID (AC…). Required unless passed per-call.
 * @property {string} [authToken]    - Default Auth Token. Signs webhooks; used as Basic password unless an API Key is given.
 * @property {string} [apiKeySid]    - Optional API Key SID (SK…). Preferred Basic username in production.
 * @property {string} [apiKeySecret] - Optional API Key Secret. Basic password when apiKeySid is set.
 * @property {number} [timeout=15000]
 * @property {string} [baseUrl='https://api.twilio.com']
 */

class TwilioProvider extends BaseProvider {
  /**
   * @param {TwilioConfig} [config]
   */
  constructor(config = {}) {
    super(config);
    this.name = 'twilio';
    this.accountSid = config.accountSid || null;
    this.authToken = config.authToken || null;
    this.apiKeySid = config.apiKeySid || null;
    this.apiKeySecret = config.apiKeySecret || null;
    this.timeout = config.timeout ?? 15000;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

    this.messaging = new TwilioMessagingManager(this);
    this.media = new TwilioMediaManager(this);
    this.account = new TwilioAccountManager(this);
  }

  /** Usable as long as it can resolve an Account SID + a Basic password. */
  isInitialized() {
    return Boolean(this.accountSid && (this.authToken || (this.apiKeySid && this.apiKeySecret)));
  }

  getError() {
    if (!this.accountSid) return 'Twilio: accountSid is required (constructor or per-call)';
    if (!this.authToken && !(this.apiKeySid && this.apiKeySecret)) {
      return 'Twilio: authToken (or apiKeySid + apiKeySecret) is required';
    }
    return null;
  }

  /**
   * Resolve the Basic-auth pair + Account SID for a call, honoring per-call
   * overrides over constructor defaults.
   * @private
   */
  _resolveAuth(opts) {
    const accountSid = opts.accountSid || this.accountSid;
    if (!accountSid) {
      throw new Error('Twilio: accountSid is required (per-call or in config)');
    }
    const apiKeySid = opts.apiKeySid || this.apiKeySid;
    const apiKeySecret = opts.apiKeySecret || this.apiKeySecret;
    const authToken = opts.authToken || this.authToken;

    const username = apiKeySid || accountSid;
    const password = apiKeySid ? apiKeySecret : authToken;
    if (!password) {
      throw new Error('Twilio: authToken (or apiKeySid + apiKeySecret) is required');
    }
    return { accountSid, username, password };
  }

  /**
   * Make an HTTP request to the Twilio REST API.
   *
   * Errors are thrown as TwilioApiError with code/message/moreInfo preserved.
   *
   * @param {Object} opts
   * @param {string} opts.method
   * @param {string} [opts.path]               - e.g. '/Messages.json' (Account base is prepended)
   * @param {string} [opts.accountSid]         - override default Account SID
   * @param {string} [opts.authToken]          - override default Auth Token
   * @param {string} [opts.apiKeySid]          - override default API Key SID
   * @param {string} [opts.apiKeySecret]       - override default API Key Secret
   * @param {Object} [opts.form]               - x-www-form-urlencoded body (arrays => repeated keys)
   * @param {Object} [opts.params]             - query params
   * @param {Object} [opts.headers]
   * @param {string} [opts.responseType]       - axios responseType ('arraybuffer' for media download)
   * @param {string} [opts.absoluteUrl]        - bypass base+account prepend (media binary / next_page_uri)
   * @param {string} [opts.baseUrl]            - override base (e.g. messaging.twilio.com)
   * @param {boolean} [opts.accountScoped=true]- when false, base is `${baseUrl}/${path}` without /Accounts/{sid}
   * @param {boolean} [opts.returnResponse]    - resolve with the full axios response (for header access)
   * @param {number} [opts.timeout]
   * @returns {Promise<Object|Buffer>}
   */
  async request(opts) {
    const { accountSid, username, password } = this._resolveAuth(opts);

    const base = (opts.baseUrl || this.baseUrl).replace(/\/+$/, '');
    let url;
    if (opts.absoluteUrl) {
      url = opts.absoluteUrl;
    } else if (opts.accountScoped === false) {
      url = `${base}${opts.path}`;
    } else {
      url = `${base}/${API_VERSION}/Accounts/${accountSid}${opts.path}`;
    }

    const headers = {
      Accept: 'application/json',
      ...(opts.headers || {})
    };

    const axiosConfig = {
      method: opts.method,
      url,
      params: opts.params,
      headers,
      timeout: opts.timeout ?? this.timeout,
      auth: { username, password }
    };
    if (opts.responseType) axiosConfig.responseType = opts.responseType;

    if (opts.form !== undefined) {
      axiosConfig.data = toFormBody(opts.form);
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    try {
      const response = await axios(axiosConfig);
      return opts.returnResponse ? response : response.data;
    } catch (err) {
      throw TwilioApiError.fromAxiosError(err);
    }
  }
}

/**
 * Encode an object as `application/x-www-form-urlencoded`. Skips
 * undefined/null. Array values are appended as repeated keys (Twilio's
 * convention for `MediaUrl`). Plain objects are JSON-stringified (used by
 * `ContentVariables`, `PersistentAction`, etc.).
 * @param {Object} obj
 * @returns {URLSearchParams}
 */
function toFormBody(obj) {
  const usp = new URLSearchParams();
  for (const key of Object.keys(obj || {})) {
    const v = obj[key];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        usp.append(key, typeof item === 'object' ? JSON.stringify(item) : String(item));
      }
    } else if (typeof v === 'object') {
      usp.append(key, JSON.stringify(v));
    } else if (typeof v === 'boolean') {
      usp.append(key, v ? 'true' : 'false');
    } else {
      usp.append(key, String(v));
    }
  }
  return usp;
}

module.exports = {
  TwilioProvider,
  toChannelAddress,
  parseChannelAddress,
  toFormBody,
  API_VERSION,
  DEFAULT_BASE_URL
};
