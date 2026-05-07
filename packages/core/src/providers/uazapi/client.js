/**
 * Uazapi Provider - Client for the Uazapi WhatsApp API (uazapiGO 2.1.0)
 *
 * Multi-server (multi-subscription) support:
 *   - Each Uazapi subscription is a "server" identified by `id` + `baseUrl` + `adminToken`.
 *   - WhatsApp instances inside a server authenticate with a per-instance `token`.
 *   - The provider stays stateless; the consuming app persists which
 *     (serverId, instanceId, instanceToken) belongs to each tenant.
 *
 * @see https://docs.uazapi.com/
 * @see Spec: https://docs.uazapi.com/openapi-bundled.json
 */

const axios = require('axios');
const { BaseProvider } = require('../base');
const { UazapiServerPool } = require('./server-pool');
const { UazapiInstanceManager } = require('./instance');
const { UazapiMessagingManager } = require('./messaging');
const { UazapiChatsManager } = require('./chats');
const { UazapiContactsManager } = require('./contacts');
const { UazapiMessagesManager } = require('./messages');
const { UazapiGroupsManager } = require('./groups');
const { UazapiProfileManager } = require('./profile');
const { UazapiWebhookManager } = require('./webhooks-manager');

/**
 * Uazapi Provider Configuration
 * @typedef {Object} UazapiConfig
 *
 * Single-server shorthand (becomes one entry in the pool):
 * @property {string} [baseUrl]      - e.g. 'https://free.uazapi.com'
 * @property {string} [adminToken]   - Admin token for that server
 * @property {number} [capacity]     - Optional capacity for the single server
 *
 * Multi-server form:
 * @property {Array<Object>} [servers] - Array of UazapiServerConfig
 * @property {string|Function} [selectionStrategy] - 'pinned' | 'round-robin' |
 *                                                   'weighted-round-robin' |
 *                                                   'least-loaded' | 'fill-first' |
 *                                                   custom function
 * @property {Function} [getServerLoad] - async (serverId) => number; required for
 *                                        load-aware strategies.
 *
 * @property {number} [timeout=15000] - Request timeout in ms
 */

/**
 * Uazapi Provider for WhatsApp messaging.
 */
class UazapiProvider extends BaseProvider {
  /**
   * @param {UazapiConfig} config
   */
  constructor(config = {}) {
    super(config);
    this.name = 'uazapi';
    this.timeout = config.timeout ?? 15000;
    this.initError = null;

    // Build the server list from either form
    let servers;
    if (Array.isArray(config.servers) && config.servers.length > 0) {
      servers = config.servers;
    } else if (config.baseUrl) {
      servers = [
        {
          id: config.id || 'default',
          baseUrl: config.baseUrl,
          adminToken: config.adminToken,
          capacity: config.capacity ?? Infinity
        }
      ];
    } else {
      servers = [];
      this.initError = 'Uazapi requires { baseUrl } or { servers: [...] }';
    }

    try {
      this.pool = new UazapiServerPool(servers, {
        strategy: config.selectionStrategy,
        getLoad: config.getServerLoad
      });
    } catch (err) {
      this.pool = new UazapiServerPool([]);
      this.initError = err.message;
    }

    // Sub-managers
    this.instance = new UazapiInstanceManager(this);
    this.messaging = new UazapiMessagingManager(this);
    this.chats = new UazapiChatsManager(this);
    this.contacts = new UazapiContactsManager(this);
    this.messages = new UazapiMessagesManager(this);
    this.groups = new UazapiGroupsManager(this);
    this.profile = new UazapiProfileManager(this);
    this.webhooks = new UazapiWebhookManager(this);
  }

  /**
   * @returns {boolean}
   */
  isInitialized() {
    return !this.initError && this.pool.size() > 0;
  }

  /**
   * @returns {string|null}
   */
  getError() {
    if (this.initError) return this.initError;
    if (this.pool.size() === 0) return 'At least one server is required';
    return null;
  }

  /**
   * Make an HTTP request to a Uazapi server.
   *
   * Authentication:
   *   - If `useAdminToken: true`, sends `admintoken` header (the server's adminToken).
   *   - Otherwise sends `token` header (the instance token, required by caller).
   *
   * Routing:
   *   - `serverId` (preferred) or `serverUrl` selects the target server.
   *   - With a single-server pool, the routing fields can be omitted.
   *
   * @param {Object} opts
   * @param {string} opts.method
   * @param {string} opts.path                 - e.g. '/send/text'
   * @param {Object} [opts.data]               - JSON body
   * @param {Object} [opts.params]             - query string
   * @param {string} [opts.token]              - per-instance token
   * @param {boolean} [opts.useAdminToken]     - true => use server.adminToken
   * @param {string} [opts.serverId]
   * @param {string} [opts.serverUrl]
   * @param {Object} [opts.headers]
   * @param {number} [opts.timeout]
   * @returns {Promise<Object>}
   */
  async request(opts) {
    if (this.initError) throw new Error(`Uazapi: ${this.initError}`);

    const server = this.pool.resolve({
      serverId: opts.serverId,
      serverUrl: opts.serverUrl
    });

    if (!server) {
      if (this.pool.size() > 1) {
        throw new Error(
          'Uazapi: serverId or serverUrl is required when multiple servers are configured'
        );
      }
      throw new Error(
        `Uazapi: server not found (id=${opts.serverId ?? '-'}, url=${opts.serverUrl ?? '-'})`
      );
    }

    const headers = {
      Accept: 'application/json',
      ...opts.headers
    };

    if (opts.useAdminToken) {
      if (!server.adminToken) {
        throw new Error(`Uazapi: adminToken is missing for server '${server.id}'`);
      }
      headers.admintoken = server.adminToken;
    } else {
      if (!opts.token) {
        throw new Error('Uazapi: instance token is required');
      }
      headers.token = opts.token;
    }

    // Only set Content-Type for bodied requests; some Uazapi endpoints accept GET only
    const hasBody = opts.data !== undefined && opts.data !== null;
    if (hasBody) headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    const response = await axios({
      method: opts.method,
      url: `${server.baseUrl}${opts.path}`,
      data: hasBody ? opts.data : undefined,
      params: opts.params,
      headers,
      timeout: opts.timeout ?? this.timeout
    });

    return response.data;
  }
}

module.exports = { UazapiProvider };
