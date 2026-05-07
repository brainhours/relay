/**
 * Meta WhatsApp Cloud API Provider — official Meta Graph API client.
 *
 * Single endpoint (`https://graph.facebook.com/{apiVersion}`), multi-tenant
 * via per-call credentials. The provider holds only global config:
 *
 *   - apiVersion (default 'v22.0')
 *   - appSecret  (used only for HMAC validation of incoming webhooks)
 *   - timeout    (axios default)
 *
 * Each method on the messaging/templates/media/account managers takes
 * `{ accessToken, phoneNumberId | businessAccountId, ...payload }` so the
 * consuming app can route per-tenant credentials at call time.
 *
 * @example  Send a template
 * const { MetaCloudApiProvider } = require('@guilhermegoulart1/relay-core');
 * const meta = new MetaCloudApiProvider({
 *   apiVersion: 'v22.0',
 *   appSecret: process.env.META_APP_SECRET
 * });
 * await meta.messaging.sendTemplate({
 *   accessToken: org.accessToken,
 *   phoneNumberId: org.phoneNumberId,
 *   to: '5511999999999',
 *   templateName: 'lembrete_renovacao',
 *   language: 'pt_BR',
 *   components: [{ type: 'body', parameters: [{ type: 'text', text: 'Joana' }] }]
 * });
 *
 * @example  Webhook intake
 * const { parseCloudApiWebhook, validateCloudApiSignature } = require('@guilhermegoulart1/relay-core');
 * app.use('/webhooks/meta', express.json({
 *   verify: (req, _res, buf) => { req.rawBody = buf; }
 * }));
 * app.post('/webhooks/meta', (req, res) => {
 *   if (!validateCloudApiSignature(req.rawBody, req.headers['x-hub-signature-256'], appSecret)) {
 *     return res.sendStatus(401);
 *   }
 *   for (const event of parseCloudApiWebhook(req.body)) emitter.emit(event);
 *   res.sendStatus(200);
 * });
 */

const axios = require('axios');
const { BaseProvider } = require('../base');
const { MetaApiError } = require('./errors');
const { MetaCloudApiMessagingManager } = require('./messaging');
const { MetaCloudApiTemplateManager } = require('./templates');
const { MetaCloudApiMediaManager } = require('./media');
const { MetaCloudApiAccountManager } = require('./account');

const DEFAULT_API_VERSION = 'v22.0';
const DEFAULT_BASE_URL = 'https://graph.facebook.com';

/**
 * @typedef {Object} MetaCloudApiConfig
 * @property {string} [apiVersion='v22.0']
 * @property {string} [appSecret]
 * @property {number} [timeout=15000]
 * @property {string} [baseUrl='https://graph.facebook.com']
 */

class MetaCloudApiProvider extends BaseProvider {
  /**
   * @param {MetaCloudApiConfig} [config]
   */
  constructor(config = {}) {
    super(config);
    this.name = 'cloud-api';
    this.apiVersion = config.apiVersion || DEFAULT_API_VERSION;
    this.appSecret = config.appSecret || null;
    this.timeout = config.timeout ?? 15000;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

    this.messaging = new MetaCloudApiMessagingManager(this);
    this.templates = new MetaCloudApiTemplateManager(this);
    this.media = new MetaCloudApiMediaManager(this);
    this.account = new MetaCloudApiAccountManager(this);
  }

  isInitialized() { return true; }
  getError() { return null; }

  /**
   * Make an HTTP request to the Graph API. Caller passes `accessToken`
   * per-call (this provider does not hold tenant tokens).
   *
   * Errors thrown as MetaApiError with code/title/traceId preserved.
   *
   * @param {Object} opts
   * @param {string} opts.method
   * @param {string} opts.path                  - e.g. '/{phoneNumberId}/messages' (apiVersion is prepended)
   * @param {string} opts.accessToken           - REQUIRED Bearer token
   * @param {Object} [opts.data]                - JSON body
   * @param {Object} [opts.params]              - query params
   * @param {Object} [opts.formData]            - multipart form (form-data instance)
   * @param {Object} [opts.headers]
   * @param {string} [opts.responseType]        - axios responseType ('arraybuffer' for media download CDN call)
   * @param {string} [opts.absoluteUrl]         - bypass apiVersion prepend (for media CDN URL)
   * @param {number} [opts.timeout]
   * @returns {Promise<Object>}
   */
  async request(opts) {
    if (!opts.accessToken) {
      throw new Error('Cloud API: accessToken is required for every request');
    }

    const url = opts.absoluteUrl || `${this.baseUrl}/${this.apiVersion}${opts.path}`;

    const headers = {
      Authorization: `Bearer ${opts.accessToken}`,
      Accept: 'application/json',
      ...(opts.headers || {})
    };

    const axiosConfig = {
      method: opts.method,
      url,
      params: opts.params,
      headers,
      timeout: opts.timeout ?? this.timeout
    };
    if (opts.responseType) axiosConfig.responseType = opts.responseType;

    if (opts.formData) {
      axiosConfig.data = opts.formData;
      Object.assign(headers, opts.formData.getHeaders());
    } else if (opts.data !== undefined) {
      axiosConfig.data = opts.data;
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    try {
      const response = await axios(axiosConfig);
      return response.data;
    } catch (err) {
      throw MetaApiError.fromAxiosError(err);
    }
  }
}

module.exports = { MetaCloudApiProvider };
