/**
 * Uazapi Webhook Manager
 *
 * Configures the per-instance webhook on Uazapi (POST /webhook).
 *
 * Uazapi supports two modes:
 *   - "Simple mode" (recommended): omit `id` and `action`. Manages a single
 *     webhook per instance, creating or updating automatically.
 *   - "Multi-webhook mode": pass `action: 'add' | 'update' | 'delete'` and
 *     manage multiple webhooks by `id`.
 *
 * This manager exposes both: `set()` for the simple mode (95% of cases) and
 * `addOne / update / delete` for advanced usage.
 *
 * Always sends `excludeMessages: ['wasSentByApi']` by default so messages
 * sent through the API don't trigger webhook loops.
 *
 * @see https://docs.uazapi.com/  ->  POST /webhook
 */

const VALID_EVENTS = [
  'connection',
  'history',
  'messages',
  'messages_update',
  'newsletter_messages',
  'call',
  'contacts',
  'presence',
  'groups',
  'labels',
  'chats',
  'chat_labels',
  'blocks',
  'sender'
];

const VALID_EXCLUDES = [
  'wasSentByApi',
  'wasNotSentByApi',
  'fromMeYes',
  'fromMeNo',
  'isGroupYes',
  'isGroupNo'
];

function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class UazapiWebhookManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Get the current webhook configuration(s) for an instance.
   *
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.serverId]
   * @returns {Promise<Object[]>}
   */
  async get({ token, serverId } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/webhook',
      token,
      serverId
    });
  }

  /**
   * Configure the instance webhook in "simple mode" (single webhook per
   * instance, automatically created/updated).
   *
   * `excludeMessages` defaults to `['wasSentByApi']` to prevent loops; pass
   * an explicit array (or empty array) to override.
   *
   * @param {Object} params
   * @param {string} params.token
   * @param {string} [params.serverId]
   * @param {string} params.url
   * @param {string[]} [params.events]            - default: ['messages','messages_update','connection']
   * @param {string[]} [params.excludeMessages]   - default: ['wasSentByApi']
   * @param {boolean} [params.enabled=true]
   * @param {boolean} [params.addUrlEvents]
   * @param {boolean} [params.addUrlTypesMessages]
   * @returns {Promise<Object>}
   */
  async set({
    token,
    serverId,
    url,
    events = ['messages', 'messages_update', 'connection'],
    excludeMessages = ['wasSentByApi'],
    enabled = true,
    addUrlEvents,
    addUrlTypesMessages
  } = {}) {
    if (!url) throw new Error('Uazapi.webhooks.set: url is required');
    return this.provider.request({
      method: 'POST',
      path: '/webhook',
      token,
      serverId,
      data: omitUndef({
        url,
        events,
        excludeMessages,
        enabled,
        addUrlEvents,
        addUrlTypesMessages
      })
    });
  }

  /**
   * Add a new webhook (multi-webhook mode). Use this only when you need more
   * than one webhook per instance.
   *
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async addOne({
    token,
    serverId,
    url,
    events = ['messages', 'messages_update', 'connection'],
    excludeMessages = ['wasSentByApi'],
    enabled = true,
    addUrlEvents,
    addUrlTypesMessages
  } = {}) {
    if (!url) throw new Error('Uazapi.webhooks.addOne: url is required');
    return this.provider.request({
      method: 'POST',
      path: '/webhook',
      token,
      serverId,
      data: omitUndef({
        action: 'add',
        url,
        events,
        excludeMessages,
        enabled,
        addUrlEvents,
        addUrlTypesMessages
      })
    });
  }

  /**
   * Update a specific webhook (multi-webhook mode).
   *
   * @param {Object} params
   * @param {string} params.id
   * @returns {Promise<Object>}
   */
  async update({ token, serverId, id, ...changes } = {}) {
    if (!id) throw new Error('Uazapi.webhooks.update: id is required');
    return this.provider.request({
      method: 'POST',
      path: '/webhook',
      token,
      serverId,
      data: omitUndef({ action: 'update', id, ...changes })
    });
  }

  /**
   * Delete a specific webhook by id.
   *
   * @param {Object} params
   * @param {string} params.id
   * @returns {Promise<Object>}
   */
  async delete({ token, serverId, id } = {}) {
    if (!id) throw new Error('Uazapi.webhooks.delete: id is required');
    return this.provider.request({
      method: 'POST',
      path: '/webhook',
      token,
      serverId,
      data: { action: 'delete', id }
    });
  }

  /**
   * Idempotent helper: ensures the simple-mode webhook is set to the given
   * `url` and `events`. If the current configuration already matches, no API
   * call is made.
   *
   * @param {Object} params
   * @returns {Promise<{updated: boolean, webhook: Object}>}
   */
  async ensure({
    token,
    serverId,
    url,
    events = ['messages', 'messages_update', 'connection'],
    excludeMessages = ['wasSentByApi'],
    enabled = true,
    addUrlEvents,
    addUrlTypesMessages
  } = {}) {
    if (!url) throw new Error('Uazapi.webhooks.ensure: url is required');

    let current;
    try {
      current = await this.get({ token, serverId });
    } catch {
      current = null;
    }

    const arr = Array.isArray(current) ? current : current ? [current] : [];
    const match = arr.find((w) => w && w.url === url);

    const eventsSorted = [...events].sort();
    const excludesSorted = [...excludeMessages].sort();

    const matchesAll =
      match &&
      match.enabled === enabled &&
      Array.isArray(match.events) &&
      [...match.events].sort().join(',') === eventsSorted.join(',') &&
      Array.isArray(match.excludeMessages) &&
      [...match.excludeMessages].sort().join(',') === excludesSorted.join(',') &&
      (addUrlEvents === undefined || match.addUrlEvents === addUrlEvents) &&
      (addUrlTypesMessages === undefined ||
        match.addUrlTypesMessages === addUrlTypesMessages);

    if (matchesAll) return { updated: false, webhook: match };

    const webhook = await this.set({
      token,
      serverId,
      url,
      events,
      excludeMessages,
      enabled,
      addUrlEvents,
      addUrlTypesMessages
    });
    return { updated: true, webhook };
  }

  /**
   * Recent webhook delivery errors (per instance).
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async getErrors({ token, serverId } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/webhook/errors',
      token,
      serverId
    });
  }
}

module.exports = {
  UazapiWebhookManager,
  VALID_EVENTS,
  VALID_EXCLUDES
};
