/**
 * Zernio Provider — official Zernio Social Media API client.
 *
 * Zernio is a unified publishing + social-inbox + ads API covering 15 channels
 * (Twitter/X, Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest,
 * Reddit, Bluesky, Threads, Google Business, Telegram, Snapchat, WhatsApp,
 * Discord). Unlike the messaging providers in this package (Unipile, Twilio,
 * Cloud API…), Zernio is a SINGLE-ENDPOINT, SINGLE-KEY API:
 *
 *   - Base URL: `https://zernio.com/api`, all routes prefixed `/v1`.
 *   - Auth: one Bearer API key for the whole Zernio account. The tenant
 *     boundary is the `profileId` / `accountId` you pass per call — not the
 *     credential (mirrors Unipile's single-key, account_id-scoped model).
 *   - Bodies are JSON (multipart only for direct media upload).
 *
 * Managers (all reachable as properties on the provider instance):
 *   - posts        — publish/schedule to every channel, queue, validation
 *   - media        — upload / presign
 *   - accounts     — connected accounts + profiles management
 *   - connect      — OAuth connect + WhatsApp Embedded Signup / credentials
 *   - messaging    — unified inbox DMs (IG/FB/WhatsApp/Telegram/Twitter/Reddit/Bluesky)
 *   - comments     — list/reply/hide/like/private-reply across platforms
 *   - reviews      — Facebook + Google Business reviews
 *   - whatsapp     — templates, flows, phone numbers, calling, groups, sandbox
 *   - analytics    — post/account + per-platform + inbox analytics
 *   - crm          — contacts, custom fields, broadcasts, sequences, workflows, comment automations
 *   - ads          — campaigns, ad sets, audiences, CTWA, conversions, lead forms, tracking tags
 *   - engagement   — Twitter actions, Reddit search, Discord, IG stories, LinkedIn mentions
 *   - webhooks     — register / list / update / delete delivery webhooks
 *
 * @example  Publish to LinkedIn + Instagram at once
 * const { ZernioProvider } = require('@guilhermegoulart1/relay-core');
 * const zernio = new ZernioProvider({ apiKey: process.env.ZERNIO_API_KEY });
 * await zernio.posts.create({
 *   content: 'New drop 🚀',
 *   publishNow: true,
 *   platforms: [
 *     { platform: 'linkedin',  accountId: liAccountId },
 *     { platform: 'instagram', accountId: igAccountId }
 *   ]
 * });
 *
 * @example  WhatsApp Embedded Signup (no manual BM token)
 * const { authUrl } = await zernio.connect.getConnectUrl({
 *   platform: 'whatsapp', profileId, redirectUrl: 'https://app.example.com/cb'
 * });
 * // redirect the client to authUrl — Meta hosts the WABA + number picker.
 *
 * @example  Webhook intake
 * const { parseZernioWebhook, validateZernioSignature } = require('@guilhermegoulart1/relay-core');
 * app.use('/webhooks/zernio', express.json({ verify: (req,_r,buf){ req.rawBody = buf; } }));
 * app.post('/webhooks/zernio', (req, res) => {
 *   if (!validateZernioSignature(req.rawBody, req.headers['x-zernio-signature'], secret)) {
 *     return res.sendStatus(401);
 *   }
 *   const event = parseZernioWebhook(req.body);
 *   if (event) emitter.emit(event);
 *   res.sendStatus(200);
 * });
 */

const axios = require('axios');
const { BaseProvider } = require('../base');
const { ZernioApiError } = require('./errors');
const { ZernioPostsManager } = require('./posts');
const { ZernioMediaManager } = require('./media');
const { ZernioAccountsManager } = require('./accounts');
const { ZernioConnectManager } = require('./connect');
const { ZernioMessagingManager } = require('./messaging');
const { ZernioCommentsManager } = require('./comments');
const { ZernioReviewsManager } = require('./reviews');
const { ZernioWhatsAppManager } = require('./whatsapp');
const { ZernioAnalyticsManager } = require('./analytics');
const { ZernioCrmManager } = require('./crm');
const { ZernioAdsManager } = require('./ads');
const { ZernioEngagementManager } = require('./engagement');
const { ZernioWebhooksManager } = require('./webhooks-manager');

const DEFAULT_BASE_URL = 'https://zernio.com/api';
const API_VERSION = 'v1';

/**
 * @typedef {Object} ZernioConfig
 * @property {string} apiKey            - Zernio API key (Bearer). Required.
 * @property {string} [webhookSecret]   - HMAC-SHA256 secret used to verify inbound webhook signatures.
 * @property {number} [timeout=20000]
 * @property {string} [baseUrl='https://zernio.com/api']
 */

class ZernioProvider extends BaseProvider {
  /**
   * @param {ZernioConfig} [config]
   */
  constructor(config = {}) {
    super(config);
    this.name = 'zernio';
    this.apiKey = config.apiKey || null;
    this.webhookSecret = config.webhookSecret || null;
    this.timeout = config.timeout ?? 20000;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

    this.posts = new ZernioPostsManager(this);
    this.media = new ZernioMediaManager(this);
    this.accounts = new ZernioAccountsManager(this);
    this.connect = new ZernioConnectManager(this);
    this.messaging = new ZernioMessagingManager(this);
    this.comments = new ZernioCommentsManager(this);
    this.reviews = new ZernioReviewsManager(this);
    this.whatsapp = new ZernioWhatsAppManager(this);
    this.analytics = new ZernioAnalyticsManager(this);
    this.crm = new ZernioCrmManager(this);
    this.ads = new ZernioAdsManager(this);
    this.engagement = new ZernioEngagementManager(this);
    this.webhooks = new ZernioWebhooksManager(this);
  }

  isInitialized() {
    return Boolean(this.apiKey);
  }

  getError() {
    if (!this.apiKey) return 'Zernio: apiKey is required';
    return null;
  }

  /**
   * Make an HTTP request to the Zernio API. The `/v1` prefix and base URL are
   * prepended unless `absoluteUrl` is given.
   *
   * Errors are thrown as ZernioApiError with statusCode/code/message/details
   * preserved.
   *
   * @param {Object} opts
   * @param {string} opts.method                  - GET | POST | PATCH | DELETE
   * @param {string} [opts.path]                   - e.g. '/posts' (=> /api/v1/posts)
   * @param {Object} [opts.params]                 - query params
   * @param {Object} [opts.data]                   - JSON body
   * @param {Object} [opts.formData]               - multipart form-data instance (overrides data)
   * @param {Object} [opts.headers]                - extra headers (e.g. x-request-id for idempotency)
   * @param {string} [opts.responseType]           - axios responseType ('arraybuffer' for binary)
   * @param {string} [opts.absoluteUrl]            - bypass base + /v1 prepend
   * @param {number} [opts.timeout]
   * @returns {Promise<Object|Buffer>}
   */
  async request(opts) {
    if (!this.apiKey) {
      throw new ZernioApiError({ statusCode: 401, message: 'Zernio: apiKey is required for every request' });
    }

    const url = opts.absoluteUrl || `${this.baseUrl}/${API_VERSION}${opts.path}`;

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
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
      Object.assign(headers, typeof opts.formData.getHeaders === 'function' ? opts.formData.getHeaders() : {});
    } else if (opts.data !== undefined) {
      axiosConfig.data = opts.data;
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    try {
      const response = await axios(axiosConfig);
      return response.data;
    } catch (err) {
      throw ZernioApiError.fromAxiosError(err);
    }
  }

  /** Convenience GET. */
  get(path, params, opts = {}) {
    return this.request({ method: 'GET', path, params, ...opts });
  }

  /** Convenience POST. */
  post(path, data, opts = {}) {
    return this.request({ method: 'POST', path, data, ...opts });
  }

  /** Convenience PATCH. */
  patch(path, data, opts = {}) {
    return this.request({ method: 'PATCH', path, data, ...opts });
  }

  /** Convenience DELETE. */
  del(path, opts = {}) {
    return this.request({ method: 'DELETE', path, ...opts });
  }
}

module.exports = {
  ZernioProvider,
  DEFAULT_BASE_URL,
  API_VERSION
};
