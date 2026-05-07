/**
 * Uazapi Instance Manager
 *
 * Handles WhatsApp instance lifecycle:
 *   - admin: create, listAll, delete
 *   - per-instance: connect (QR/pairing), status, disconnect
 *
 * Endpoints:
 *   POST   /instance/create      (admintoken)
 *   GET    /instance/all         (admintoken)
 *   POST   /instance/connect     (token)   -> QR or pairing code
 *   GET    /instance/status      (token)
 *   POST   /instance/disconnect  (token)
 *   DELETE /instance             (token)
 */

const { BaseAccountManager } = require('../base');

class UazapiInstanceManager extends BaseAccountManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  /**
   * Create a new WhatsApp instance on a server.
   *
   * The pool selects the target server using the configured strategy
   * (round-robin, weighted, least-loaded, etc.). You can force a specific
   * server with `serverId`, or override the strategy for this call.
   *
   * The returned object includes `serverId` and `serverUrl` so the calling
   * app can persist them for future operations.
   *
   * @param {Object} options
   * @param {string} options.name                    - Instance name
   * @param {string} [options.serverId]              - Force a specific server
   * @param {string|Function} [options.strategy]     - Override strategy for this call
   * @param {string[]} [options.adminFields]         - [adminField01, adminField02]
   * @returns {Promise<Object>} Instance + { serverId, serverUrl }
   */
  async create({ name, serverId, strategy, adminFields = [] } = {}) {
    if (!name) throw new Error("Uazapi.instance.create: 'name' is required");

    const server = serverId
      ? this.provider.pool.get(serverId)
      : await this.provider.pool.pickForCreate({ name, strategy });

    if (!server) {
      throw new Error(
        serverId
          ? `Uazapi.instance.create: server '${serverId}' not found`
          : 'Uazapi.instance.create: no server available'
      );
    }

    const data = await this.provider.request({
      method: 'POST',
      path: '/instance/create',
      data: {
        name,
        adminField01: adminFields[0],
        adminField02: adminFields[1]
      },
      useAdminToken: true,
      serverId: server.id
    });

    return {
      ...data,
      serverId: server.id,
      serverUrl: server.baseUrl
    };
  }

  /**
   * List instances on a specific server (admin).
   * Without `serverId`, lists across all servers in parallel and aggregates.
   *
   * @param {Object} [options]
   * @param {string} [options.serverId]
   * @returns {Promise<Object[]>}
   */
  async listAll({ serverId } = {}) {
    if (serverId) {
      const data = await this.provider.request({
        method: 'GET',
        path: '/instance/all',
        useAdminToken: true,
        serverId
      });
      return Array.isArray(data) ? data.map((i) => ({ ...i, serverId })) : data;
    }

    const all = this.provider.pool.list().filter((s) => s.adminToken);
    const results = await Promise.all(
      all.map(async (s) => {
        try {
          const data = await this.provider.request({
            method: 'GET',
            path: '/instance/all',
            useAdminToken: true,
            serverId: s.id
          });
          return Array.isArray(data) ? data.map((i) => ({ ...i, serverId: s.id })) : [];
        } catch {
          return [];
        }
      })
    );
    return results.flat();
  }

  /**
   * Connect an instance to WhatsApp. Returns a QR code (default) or a pairing
   * code (when `phone` is provided).
   *
   * @param {Object} options
   * @param {string} options.token
   * @param {string} [options.serverId]
   * @param {string} [options.phone]       - if provided, generates pairing code
   * @param {string} [options.browser]     - 'auto' | 'safari' | 'firefox' | 'edge' | 'chrome'
   * @param {string} [options.systemName]
   * @returns {Promise<Object>}
   */
  async connect({ token, serverId, phone, browser, systemName } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/instance/connect',
      data: { phone, browser, systemName },
      token,
      serverId
    });
  }

  /**
   * Get current connection status of an instance.
   * @param {Object} options
   * @param {string} options.token
   * @param {string} [options.serverId]
   * @returns {Promise<Object>}
   */
  async getStatus({ token, serverId } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/instance/status',
      token,
      serverId
    });
  }

  /**
   * Disconnect an instance (logs out the WhatsApp session, instance is preserved).
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async disconnect({ token, serverId } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/instance/disconnect',
      token,
      serverId
    });
  }

  /**
   * Permanently delete an instance.
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async delete({ token, serverId } = {}) {
    return this.provider.request({
      method: 'DELETE',
      path: '/instance',
      token,
      serverId
    });
  }

  /**
   * Update message-presence on an instance ('available' | 'unavailable').
   * @param {Object} options
   * @param {string} options.token
   * @param {string} options.presence
   * @param {string} [options.serverId]
   */
  async setPresence({ token, serverId, presence } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/instance/presence',
      data: { presence },
      token,
      serverId
    });
  }

  // ---- BaseAccountManager contract ----

  /**
   * Not applicable — Uazapi uses QR/pairing code via `connect()`.
   * @returns {never}
   */
  async getHostedAuthLink() {
    throw new Error(
      "Uazapi does not support hosted OAuth. Use UazapiProvider.instance.connect({ token, serverId }) to obtain a QR or pairing code."
    );
  }

  /**
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getById(options) {
    return this.getStatus(options);
  }
}

module.exports = { UazapiInstanceManager };
