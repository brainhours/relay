/**
 * Uazapi Server Pool
 *
 * Manages a cluster of Uazapi servers (subscriptions) with heterogeneous
 * capacities and pluggable selection strategies. The Relay stays stateless;
 * the consuming app provides a `getLoad(serverId)` callback when load-aware
 * strategies are required.
 *
 * Strategies:
 *  - 'pinned'                : always picks the first enabled server
 *  - 'round-robin'           : cycles through enabled, non-full servers
 *  - 'weighted-round-robin'  : Smooth WRR (Nginx-style); proportional to weight/capacity
 *  - 'least-loaded'          : picks the server with the lowest load/capacity ratio
 *  - 'fill-first'            : fills one server up to capacity before moving on
 *  - function(eligible, ctx) : custom; receives currentLoads in ctx when available
 */

/**
 * @typedef {Object} UazapiServerConfig
 * @property {string} id          - Stable identifier (e.g., 'plano-essencial')
 * @property {string} baseUrl     - e.g., 'https://srv1.uazapi.com'
 * @property {string} [adminToken] - Required for admin endpoints (instance.create, listAll)
 * @property {number} [capacity]  - Max instances. Default Infinity.
 * @property {number} [weight]    - Weight for WRR. Default = capacity || 1.
 * @property {boolean} [enabled]  - Default true. False excludes from pickForCreate.
 * @property {string[]} [tags]    - Optional tags for custom strategies.
 */

class UazapiServerPool {
  /**
   * @param {UazapiServerConfig[]} servers
   * @param {Object} [options]
   * @param {string|Function} [options.strategy]
   * @param {Function} [options.getLoad] - async (serverId) => number
   */
  constructor(servers, { strategy, getLoad } = {}) {
    this.servers = new Map();
    for (const s of servers || []) this._normalize(s);

    // Default: 'pinned' for single-server, 'round-robin' for multi-server
    this.strategy = strategy ?? (this.servers.size <= 1 ? 'pinned' : 'round-robin');
    this.getLoad = getLoad || null;

    // Internal counters
    this._rrIndex = 0;
    this._wrrCounters = new Map();
  }

  _normalize(s) {
    if (!s || !s.id || !s.baseUrl) {
      throw new Error('Uazapi server requires { id, baseUrl }');
    }
    const baseUrl = String(s.baseUrl).replace(/\/+$/, ''); // strip trailing /
    const capacity = s.capacity ?? Infinity;
    const merged = {
      capacity,
      enabled: true,
      weight: s.weight ?? (Number.isFinite(capacity) ? capacity : 1),
      tags: [],
      ...s,
      baseUrl
    };
    this.servers.set(s.id, merged);
  }

  // -------------------------------------------------------------------------
  // Runtime reconfiguration (assinaturas adicionadas/removidas/alteradas)
  // -------------------------------------------------------------------------

  /**
   * Add a new server to the pool (idempotent: replaces if id already exists).
   * @param {UazapiServerConfig} server
   */
  add(server) {
    this._normalize(server);
  }

  /**
   * Patch an existing server in the pool.
   * @param {string} id
   * @param {Partial<UazapiServerConfig>} patch
   */
  update(id, patch) {
    const cur = this.servers.get(id);
    if (!cur) throw new Error(`Uazapi: server '${id}' not found`);
    const next = { ...cur, ...patch };
    if (patch.baseUrl) next.baseUrl = String(patch.baseUrl).replace(/\/+$/, '');
    this.servers.set(id, next);
  }

  /**
   * Remove a server from the pool.
   * @param {string} id
   */
  remove(id) {
    this.servers.delete(id);
    this._wrrCounters.delete(id);
  }

  /** Enable a previously disabled server. */
  enable(id) { this.update(id, { enabled: true }); }

  /** Disable without removing (excluded from pickForCreate, still usable via resolve). */
  disable(id) { this.update(id, { enabled: false }); }

  // -------------------------------------------------------------------------
  // Read accessors
  // -------------------------------------------------------------------------

  size() { return this.servers.size; }
  list() { return Array.from(this.servers.values()); }
  get(id) { return this.servers.get(id) || null; }
  findByUrl(url) {
    if (!url) return null;
    const normalized = String(url).replace(/\/+$/, '');
    return this.list().find((s) => s.baseUrl === normalized) || null;
  }

  /**
   * Resolve a server for an existing instance call. Allows hits on disabled
   * servers (we cannot break operations on already-provisioned instances).
   *
   * @param {Object} opts
   * @param {string} [opts.serverId]
   * @param {string} [opts.serverUrl]
   * @returns {Object|null}
   */
  resolve({ serverId, serverUrl } = {}) {
    if (serverId) return this.get(serverId);
    if (serverUrl) return this.findByUrl(serverUrl);
    if (this.servers.size === 1) return this.list()[0];
    return null;
  }

  /**
   * Snapshot of pool state including current load (when getLoad is available).
   * Useful for admin UIs.
   *
   * @returns {Promise<Array<UazapiServerConfig & { load: number|null }>>}
   */
  async stats() {
    const all = this.list();
    if (!this.getLoad) return all.map((s) => ({ ...s, load: null }));

    const entries = await Promise.all(
      all.map(async (s) => {
        try {
          return [s.id, await this.getLoad(s.id)];
        } catch {
          return [s.id, null];
        }
      })
    );
    const m = new Map(entries);
    return all.map((s) => ({ ...s, load: m.get(s.id) }));
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  /**
   * Pick a server for creating a new instance, applying strategy + capacity + enabled.
   *
   * @param {Object} [ctx]
   * @param {string|Function} [ctx.strategy] - Override default strategy for this call
   * @param {string} [ctx.name]              - New instance name (passed to custom fn)
   * @returns {Promise<Object>}
   */
  async pickForCreate(ctx = {}) {
    const strategy = ctx.strategy ?? this.strategy;

    const enabledList = this.list().filter((s) => s.enabled);
    if (enabledList.length === 0) {
      throw new Error('Uazapi: no enabled server in pool');
    }

    const eligible = await this._filterByCapacity(enabledList);
    if (eligible.length === 0) {
      throw new Error('Uazapi: all enabled servers are at capacity');
    }

    if (typeof strategy === 'function') {
      const currentLoads = this.getLoad ? await this._loadsFor(eligible) : null;
      const picked = await strategy(eligible, { ...ctx, currentLoads });
      if (!picked) throw new Error('Uazapi: custom strategy returned no server');
      return picked;
    }

    switch (strategy) {
      case 'pinned':
        return eligible[0];

      case 'round-robin': {
        const s = eligible[this._rrIndex % eligible.length];
        this._rrIndex = (this._rrIndex + 1) % Number.MAX_SAFE_INTEGER;
        return s;
      }

      case 'weighted-round-robin':
        return this._pickWeightedRoundRobin(eligible);

      case 'least-loaded': {
        if (!this.getLoad) {
          throw new Error("Uazapi: 'least-loaded' strategy requires a getServerLoad callback");
        }
        const loads = await this._loadsFor(eligible);
        return [...loads]
          .sort(
            (a, b) =>
              a.load / (Number.isFinite(a.s.capacity) ? a.s.capacity : Infinity) -
              b.load / (Number.isFinite(b.s.capacity) ? b.s.capacity : Infinity)
          )[0].s;
      }

      case 'fill-first': {
        if (!this.getLoad) {
          // Without load info we cannot truly "fill"; degrade to 'pinned' on first.
          return eligible[0];
        }
        const loads = await this._loadsFor(eligible);
        const notFull = loads.find(({ s, load }) =>
          Number.isFinite(s.capacity) ? load < s.capacity : true
        );
        return (notFull ?? loads[0]).s;
      }

      default:
        throw new Error(`Uazapi: unknown selectionStrategy '${strategy}'`);
    }
  }

  /**
   * Smooth Weighted Round-Robin (Nginx-style). Distributes proportional to
   * weights without bursts.
   * @private
   */
  _pickWeightedRoundRobin(eligible) {
    let best = null;
    let totalWeight = 0;

    for (const s of eligible) {
      const weight = Math.max(0, Number(s.weight) || 0);
      totalWeight += weight;
      const cur = (this._wrrCounters.get(s.id) ?? 0) + weight;
      this._wrrCounters.set(s.id, cur);
      if (best === null || cur > this._wrrCounters.get(best.id)) {
        best = s;
      }
    }

    if (!best) throw new Error('Uazapi: weighted-round-robin found no candidate');
    if (totalWeight > 0) {
      this._wrrCounters.set(best.id, this._wrrCounters.get(best.id) - totalWeight);
    }
    return best;
  }

  /** @private */
  async _loadsFor(servers) {
    return Promise.all(
      servers.map(async (s) => {
        let load = 0;
        try {
          load = (await this.getLoad(s.id)) ?? 0;
        } catch {
          load = 0;
        }
        return { s, load };
      })
    );
  }

  /** @private */
  async _filterByCapacity(servers) {
    if (!this.getLoad) {
      // Without load we can only filter explicitly-zero capacities
      return servers.filter((s) => (s.capacity ?? Infinity) > 0);
    }
    const loads = await this._loadsFor(servers);
    return loads
      .filter(({ s, load }) => (Number.isFinite(s.capacity) ? load < s.capacity : true))
      .map(({ s }) => s);
  }
}

module.exports = { UazapiServerPool };
