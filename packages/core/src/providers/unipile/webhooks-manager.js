/**
 * Unipile Webhook Manager
 * Manages webhooks programmatically via Unipile API
 *
 * @see https://developer.unipile.com/reference/webhookscontroller_createwebhook
 */

/**
 * Webhook configuration
 * @typedef {Object} WebhookConfig
 * @property {string} request_url - URL to receive webhook events
 * @property {string} [source='all'] - Event source: 'messaging', 'account', 'all'
 * @property {string} [account_id] - Filter events for specific account
 * @property {Array<{key: string, value: string}>} [headers] - Custom headers to include
 */

/**
 * Webhook object returned by Unipile API
 * @typedef {Object} Webhook
 * @property {string} id - Webhook ID
 * @property {string} request_url - Destination URL
 * @property {string} source - Event source filter
 * @property {string} [account_id] - Account filter if set
 * @property {Array} headers - Custom headers
 * @property {string} created_at - Creation timestamp
 */

class UnipileWebhookManager {
  /**
   * @param {import('./client').UnipileProvider} provider
   */
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Create a new webhook
   * @param {WebhookConfig} options
   * @returns {Promise<Webhook>}
   */
  async create(options) {
    const { request_url, source = 'all', account_ids, headers = [], events, data, name, format } = options;

    if (!request_url) {
      throw new Error('request_url is required');
    }

    const url = `${this.provider.getBaseUrl()}/webhooks`;
    const body = {
      request_url,
      source
    };

    // account_ids is an array of account IDs used to scope the webhook
    if (account_ids && account_ids.length > 0) {
      body.account_ids = account_ids;
    }

    if (headers.length > 0) {
      body.headers = headers;
    }

    // ⚠️ Resend the webhook's full config. Unipile has no UPDATE endpoint, so
    // add/removeAccount do DELETE+CREATE; without resending events/data the
    // recreated webhook loses its event selection (falling back to the default
    // `message_received`) and its payload mapping. `name`/`format` preserve
    // identity and format. (Caused a production incident on 2026-06-25.)
    if (events && events.length > 0) {
      body.events = events;
    }
    if (data && data.length > 0) {
      body.data = data;
    }
    if (name) {
      body.name = name;
    }
    if (format) {
      body.format = format;
    }

    return this.provider.request({
      method: 'POST',
      url,
      data: body
    });
  }

  /**
   * List all webhooks
   * @returns {Promise<{items: Webhook[]}>}
   */
  async list() {
    const url = `${this.provider.getBaseUrl()}/webhooks`;
    return this.provider.request({ method: 'GET', url });
  }

  /**
   * Delete a webhook by ID
   * @param {string} webhookId
   * @returns {Promise<{success: boolean}>}
   */
  async delete(webhookId) {
    if (!webhookId) {
      throw new Error('webhookId is required');
    }

    const url = `${this.provider.getBaseUrl()}/webhooks/${webhookId}`;
    return this.provider.request({ method: 'DELETE', url });
  }

  /**
   * Find webhooks by account_id
   * @param {string} accountId
   * @returns {Promise<Webhook[]>}
   */
  async findByAccountId(accountId) {
    const result = await this.list();
    const webhooks = result.items || result || [];
    return webhooks.filter(wh => wh.account_id === accountId);
  }

  /**
   * Find webhooks by request_url
   * @param {string} requestUrl
   * @returns {Promise<Webhook[]>}
   */
  async findByUrl(requestUrl) {
    const result = await this.list();
    const webhooks = result.items || result || [];
    return webhooks.filter(wh => wh.request_url === requestUrl);
  }

  /**
   * Ensure a webhook exists for an account
   * Creates if not exists, returns existing if found
   * @param {string} accountId - Unipile account ID
   * @param {string} requestUrl - Webhook destination URL
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.source='all'] - Event source filter
   * @param {Array} [options.headers=[]] - Custom headers
   * @returns {Promise<{webhook: Webhook, created: boolean}>}
   */
  async ensureForAccount(accountId, requestUrl, options = {}) {
    if (!accountId || !requestUrl) {
      throw new Error('accountId and requestUrl are required');
    }

    // Check if webhook already exists for this account
    const existing = await this.findByAccountId(accountId);
    const matchingWebhook = existing.find(wh => wh.request_url === requestUrl);

    if (matchingWebhook) {
      return { webhook: matchingWebhook, created: false };
    }

    // Create new webhook
    const webhook = await this.create({
      request_url: requestUrl,
      account_id: accountId,
      source: options.source || 'all',
      headers: options.headers || []
    });

    return { webhook, created: true };
  }

  /**
   * Remove all webhooks for an account
   * @param {string} accountId
   * @returns {Promise<{deleted: number}>}
   */
  async removeForAccount(accountId) {
    if (!accountId) {
      throw new Error('accountId is required');
    }

    const webhooks = await this.findByAccountId(accountId);
    let deleted = 0;

    for (const webhook of webhooks) {
      try {
        await this.delete(webhook.id);
        deleted++;
      } catch (error) {
        // Log but continue deleting others
        console.warn(`Failed to delete webhook ${webhook.id}:`, error.message);
      }
    }

    return { deleted };
  }

  /**
   * Remove webhooks by URL (useful for cleanup)
   * @param {string} requestUrl
   * @returns {Promise<{deleted: number}>}
   */
  async removeByUrl(requestUrl) {
    if (!requestUrl) {
      throw new Error('requestUrl is required');
    }

    const webhooks = await this.findByUrl(requestUrl);
    let deleted = 0;

    for (const webhook of webhooks) {
      try {
        await this.delete(webhook.id);
        deleted++;
      } catch (error) {
        console.warn(`Failed to delete webhook ${webhook.id}:`, error.message);
      }
    }

    return { deleted };
  }

  // ================================
  // PER-APPLICATION WEBHOOK MANAGEMENT
  // ================================

  /**
   * Ensure a webhook exists for an application URL
   * Creates if not exists, returns existing if found
   * @param {Object} options
   * @param {string} options.request_url - Webhook destination URL
   * @param {string} [options.source='messaging'] - Event source: 'messaging' or 'account_status'
   * @param {Array<{key: string, value: string}>} [options.headers=[]] - Custom headers
   * @returns {Promise<{webhook: Webhook, created: boolean}>}
   */
  async ensureWebhook(options) {
    const { request_url, source = 'messaging', headers = [] } = options;

    if (!request_url) {
      throw new Error('request_url is required');
    }

    // Check if webhook already exists for this URL and source
    const existing = await this.findByUrl(request_url);
    const matchingWebhook = existing.find(wh => wh.source === source);

    if (matchingWebhook) {
      return { webhook: matchingWebhook, created: false };
    }

    // Create new webhook (with empty account_ids initially)
    const webhook = await this.create({
      request_url,
      source,
      headers
    });

    return { webhook, created: true };
  }

  /**
   * Add an account to a webhook's account_ids filter
   * Since Unipile has no UPDATE endpoint, this does DELETE + CREATE
   * @param {string} requestUrl - Webhook URL to identify the webhook
   * @param {string} accountId - Account ID to add
   * @param {string} [source='messaging'] - Event source filter
   * @returns {Promise<{webhook: Webhook, added: boolean}>}
   */
  async addAccountToWebhook(requestUrl, accountId, source = 'messaging') {
    if (!requestUrl || !accountId) {
      throw new Error('requestUrl and accountId are required');
    }

    // Find existing webhook
    const existing = await this.findByUrl(requestUrl);
    const webhook = existing.find(wh => wh.source === source);

    if (!webhook) {
      // Create new webhook with this account
      const newWebhook = await this.create({
        request_url: requestUrl,
        source,
        account_ids: [accountId]
      });
      return { webhook: newWebhook, added: true };
    }

    // Check if account already in list
    // account_ids is array of objects {id, type, name} or strings
    const currentAccountIds = webhook.account_ids || [];
    const currentIds = currentAccountIds.map(a => typeof a === 'string' ? a : a.id);

    // ⚠️ An empty account_ids means an ALL-ACCOUNTS webhook (already covers
    // every account). Adding one account here would NARROW the webhook (via
    // DELETE+CREATE) down to that single account and break all the others.
    // Deliberate no-op. (Caused a production incident on 2026-06-25.)
    if (currentIds.length === 0) {
      return { webhook, added: false, allAccounts: true };
    }

    if (currentIds.includes(accountId)) {
      return { webhook, added: false };
    }

    // DELETE + CREATE with updated account_ids (preservando a config rica)
    const updatedAccountIds = [...currentIds, accountId];

    await this.delete(webhook.id);

    const newWebhook = await this.create({
      request_url: requestUrl,
      source,
      account_ids: updatedAccountIds,
      headers: webhook.headers || [],
      events: webhook.events,
      data: webhook.data,
      name: webhook.name,
      format: webhook.format
    });

    return { webhook: newWebhook, added: true };
  }

  /**
   * Remove an account from a webhook's account_ids filter
   * Since Unipile has no UPDATE endpoint, this does DELETE + CREATE
   * @param {string} requestUrl - Webhook URL to identify the webhook
   * @param {string} accountId - Account ID to remove
   * @param {string} [source='messaging'] - Event source filter
   * @returns {Promise<{webhook: Webhook|null, removed: boolean}>}
   */
  async removeAccountFromWebhook(requestUrl, accountId, source = 'messaging') {
    if (!requestUrl || !accountId) {
      throw new Error('requestUrl and accountId are required');
    }

    // Find existing webhook
    const existing = await this.findByUrl(requestUrl);
    const webhook = existing.find(wh => wh.source === source);

    if (!webhook) {
      return { webhook: null, removed: false };
    }

    // Check if account is in list
    // account_ids is array of objects {id, type, name} or strings
    const currentAccountIds = webhook.account_ids || [];
    const currentIds = currentAccountIds.map(a => typeof a === 'string' ? a : a.id);

    // ⚠️ An empty account_ids means an ALL-ACCOUNTS webhook. Removing one
    // account from "all" cannot be expressed via account_ids, and DELETE+CREATE
    // would drop the global coverage. Deliberate no-op — the account stops
    // receiving events when it is disconnected in Unipile, not here.
    // (Caused a production incident on 2026-06-25.)
    if (currentIds.length === 0) {
      return { webhook, removed: false, allAccounts: true };
    }

    if (!currentIds.includes(accountId)) {
      return { webhook, removed: false };
    }

    // Remove account from list
    const updatedAccountIds = currentIds.filter(id => id !== accountId);

    // DELETE old webhook
    await this.delete(webhook.id);

    // If no accounts left, don't recreate (webhook deleted)
    if (updatedAccountIds.length === 0) {
      return { webhook: null, removed: true };
    }

    // CREATE with updated account_ids (preservando a config rica)
    const newWebhook = await this.create({
      request_url: requestUrl,
      source,
      account_ids: updatedAccountIds,
      headers: webhook.headers || [],
      events: webhook.events,
      data: webhook.data,
      name: webhook.name,
      format: webhook.format
    });

    return { webhook: newWebhook, removed: true };
  }

  /**
   * Get current account_ids for a webhook URL
   * @param {string} requestUrl
   * @param {string} [source='messaging']
   * @returns {Promise<string[]>}
   */
  async getAccountIds(requestUrl, source = 'messaging') {
    const existing = await this.findByUrl(requestUrl);
    const webhook = existing.find(wh => wh.source === source);
    return webhook?.account_ids || [];
  }
}

module.exports = { UnipileWebhookManager };
