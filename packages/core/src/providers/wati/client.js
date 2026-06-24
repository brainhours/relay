/**
 * Wati Provider - Client for the Wati WhatsApp Business API (BSP on top of the
 * official WhatsApp Cloud API).
 *
 * Multi-tenant by design: every Wati subscription has its OWN tenant-scoped base
 * URL (e.g. `https://live-mt-server.wati.io/388231`) plus a long-lived Bearer
 * access token. Unlike Uazapi, there is no shared admin server — the pair
 * (apiEndpoint, accessToken) fully identifies a tenant.
 *
 * The provider stays stateless: the consuming app persists each channel's
 * `(apiEndpoint, accessToken)` and passes them on every call. Construction-time
 * `config` may carry defaults for single-tenant usage, but per-call values
 * always win.
 *
 * @see https://docs.wati.io/   (API reference; paths are /api/v1/...)
 */

const axios = require('axios');
const { BaseProvider } = require('../base');
const { WatiMessagingManager } = require('./messaging');
const { WatiContactsManager } = require('./contacts');
const { WatiConversationsManager } = require('./conversations');
const { WatiTemplatesManager } = require('./templates');
const { WatiAccountManager } = require('./account');
const { WatiChatbotsManager } = require('./chatbots');

/**
 * Wati Provider Configuration
 * @typedef {Object} WatiConfig
 * @property {string} [apiEndpoint] - Tenant base URL WITHOUT trailing `/api/v1`
 *                                    (e.g. 'https://live-mt-server.wati.io/388231').
 *                                    Optional default; can be passed per-call instead.
 * @property {string} [accessToken] - Bearer token (with or without the leading
 *                                    'Bearer ' prefix). Optional default.
 * @property {number} [timeout=15000] - Request timeout in ms.
 */

/**
 * Normalize a tenant base URL: trim, drop trailing slash, and strip a trailing
 * `/api/v1` if the caller pasted the full endpoint (the managers always append
 * the full `/api/v1/...` path, so we must not double it).
 * @private
 */
function normalizeEndpoint(url) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim().replace(/\/+$/, '');
  u = u.replace(/\/api\/v\d+$/i, '');
  return u || null;
}

/**
 * Normalize a Bearer token: Wati dashboards sometimes hand out the token with
 * the 'Bearer ' prefix already attached. Accept both and always emit a clean
 * 'Bearer <token>' header value.
 * @private
 */
function normalizeBearer(token) {
  if (!token || typeof token !== 'string') return null;
  const t = token.trim();
  return /^bearer\s+/i.test(t) ? t.replace(/^bearer\s+/i, 'Bearer ') : `Bearer ${t}`;
}

class WatiProvider extends BaseProvider {
  /**
   * @param {WatiConfig} config
   */
  constructor(config = {}) {
    super(config);
    this.name = 'wati';
    this.timeout = config.timeout ?? 15000;
    this.defaultEndpoint = normalizeEndpoint(config.apiEndpoint);
    this.defaultToken = config.accessToken || null;

    // Sub-managers
    this.messaging = new WatiMessagingManager(this);
    this.contacts = new WatiContactsManager(this);
    this.conversations = new WatiConversationsManager(this);
    this.templates = new WatiTemplatesManager(this);
    this.account = new WatiAccountManager(this);
    this.chatbots = new WatiChatbotsManager(this);
  }

  /**
   * Wati needs no construction-time credentials when used statelessly (creds are
   * passed per-call). It is "initialized" as long as it constructed cleanly.
   * @returns {boolean}
   */
  isInitialized() {
    return true;
  }

  /**
   * @returns {string|null}
   */
  getError() {
    return null;
  }

  /**
   * Make an HTTP request to a Wati tenant.
   *
   * Auth: `Authorization: Bearer <accessToken>`.
   * Routing: `apiEndpoint` (per-call, falls back to the constructor default).
   *
   * @param {Object} opts
   * @param {string} opts.method
   * @param {string} opts.path              - e.g. '/api/v1/sendTemplateMessage'
   * @param {string} [opts.apiEndpoint]     - tenant base URL (overrides default)
   * @param {string} [opts.accessToken]     - Bearer token (overrides default)
   * @param {Object} [opts.data]            - JSON body
   * @param {Object} [opts.params]          - query string
   * @param {Object} [opts.headers]
   * @param {number} [opts.timeout]
   * @returns {Promise<Object>}
   */
  async request(opts) {
    const base = normalizeEndpoint(opts.apiEndpoint) || this.defaultEndpoint;
    if (!base) {
      throw new Error('Wati: apiEndpoint is required (per-call or in config)');
    }

    const bearer = normalizeBearer(opts.accessToken || this.defaultToken);
    if (!bearer) {
      throw new Error('Wati: accessToken is required (per-call or in config)');
    }

    const headers = {
      Accept: 'application/json',
      Authorization: bearer,
      ...opts.headers
    };

    const hasBody = opts.data !== undefined && opts.data !== null;
    if (hasBody) headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    const response = await axios({
      method: opts.method,
      url: `${base}${opts.path}`,
      data: hasBody ? opts.data : undefined,
      params: opts.params,
      headers,
      timeout: opts.timeout ?? this.timeout
    });

    return response.data;
  }
}

module.exports = { WatiProvider, normalizeEndpoint, normalizeBearer };
