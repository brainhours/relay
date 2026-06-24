/**
 * Twilio Content API manager — manage rich/templated message content
 * (the `contentSid` HX… templates used for WhatsApp, SMS, RCS, …).
 *
 * Unlike Programmable Messaging (form-encoded, account-scoped path), the Content
 * API lives on a SEPARATE host (`https://content.twilio.com/v1`), takes JSON
 * bodies, and is scoped to the account purely by Basic auth (no `/Accounts/{Sid}`
 * in the path). Per-call credential overrides work the same as the rest of the
 * provider (pass `accountSid` + `authToken`, or an API Key pair).
 *
 * Coverage:
 *   - create               — create a Content template
 *   - list / listAll       — page through your content
 *   - get                  — fetch one by SID
 *   - delete               — delete a Content template
 *   - listWithApprovals    — content + WhatsApp approval status (ContentAndApprovals)
 *   - requestWhatsAppApproval — submit a template for WhatsApp approval
 *   - fetchApprovals       — approval status for one content SID
 *
 * @see https://www.twilio.com/docs/content/content-api-resources
 */

const CONTENT_BASE_URL = 'https://content.twilio.com';

class TwilioContentManager {
  constructor(provider) {
    this.provider = provider;
  }

  /** @private — shared request wrapper bound to the Content API host. */
  _req(opts) {
    return this.provider.request({
      baseUrl: CONTENT_BASE_URL,
      accountScoped: false,
      ...opts
    });
  }

  /**
   * Create a Content template.
   * @param {Object} params
   * @param {Object} params.types          - channel bodies, e.g. { 'twilio/text': { body: 'Hi {{1}}' } }
   * @param {string} params.language       - ISO 639-1 (e.g. 'en', 'pt')
   * @param {string} [params.friendlyName]
   * @param {Object} [params.variables]    - default sample values, e.g. { '1': 'Joana' }
   * @returns {Promise<Object>} the Content resource (incl. `sid` HX…)
   */
  async create({ types, language, friendlyName, variables, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!types || !language) {
      throw new Error('twilio.content.create: `types` and `language` are required');
    }
    return this._req({
      method: 'POST',
      path: '/v1/Content',
      json: { friendly_name: friendlyName, language, variables, types },
      accountSid, authToken, apiKeySid, apiKeySecret
    });
  }

  /**
   * List one page of Content resources.
   * @param {Object} [params]
   * @param {number} [params.pageSize=50]
   * @param {string} [params.pageToken]    - from a previous `meta.next_page_url`
   * @returns {Promise<{ contents: any[], meta: Object }>}
   */
  async list({ pageSize = 50, pageToken, accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const params = { PageSize: pageSize };
    if (pageToken) params.PageToken = pageToken;
    return this._req({
      method: 'GET', path: '/v1/Content', params,
      accountSid, authToken, apiKeySid, apiKeySecret
    });
  }

  /**
   * Auto-paginate ALL Content resources (follows `meta.next_page_url`).
   * @param {Object} [params]
   * @param {number} [params.pageSize=200]
   * @param {number} [params.maxPages=20]   - safety cap
   * @returns {Promise<any[]>}
   */
  async listAll({ pageSize = 200, maxPages = 20, accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const out = [];
    let pageToken;
    for (let i = 0; i < maxPages; i++) {
      const res = await this.list({ pageSize, pageToken, accountSid, authToken, apiKeySid, apiKeySecret });
      const batch = res?.contents || [];
      out.push(...batch);
      const next = res?.meta?.next_page_url;
      if (!next) break;
      const m = /[?&]PageToken=([^&]+)/.exec(next);
      pageToken = m ? decodeURIComponent(m[1]) : null;
      if (!pageToken) break;
    }
    return out;
  }

  /**
   * Fetch one Content resource by SID.
   * @param {Object} params
   * @param {string} params.contentSid - HX…
   */
  async get({ contentSid, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!contentSid) throw new Error('twilio.content.get: `contentSid` is required');
    return this._req({
      method: 'GET', path: `/v1/Content/${contentSid}`,
      accountSid, authToken, apiKeySid, apiKeySecret
    });
  }

  /**
   * Delete a Content template.
   * @param {Object} params
   * @param {string} params.contentSid
   * @param {boolean} [params.deleteInWaba=false] - also remove from the WABA if synced
   */
  async delete({ contentSid, deleteInWaba, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!contentSid) throw new Error('twilio.content.delete: `contentSid` is required');
    return this._req({
      method: 'DELETE', path: `/v1/Content/${contentSid}`,
      params: deleteInWaba ? { deleteInWaba: 'true' } : undefined,
      accountSid, authToken, apiKeySid, apiKeySecret
    });
  }

  /**
   * List Content together with WhatsApp approval status (best source for a
   * template picker — you get `sid`, `friendly_name`, `language`, `variables`,
   * `types`, plus `approval_requests` with the WhatsApp status/category).
   * @param {Object} [params]
   * @param {number} [params.pageSize=50]
   * @param {string} [params.pageToken]
   * @returns {Promise<{ contents: any[], meta: Object }>}
   */
  async listWithApprovals({ pageSize = 50, pageToken, accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const params = { PageSize: pageSize };
    if (pageToken) params.PageToken = pageToken;
    return this._req({
      method: 'GET', path: '/v1/ContentAndApprovals', params,
      accountSid, authToken, apiKeySid, apiKeySecret
    });
  }

  /**
   * Auto-paginate ALL Content+approvals (follows `meta.next_page_url`).
   * @param {Object} [params] - see listWithApprovals; `pageSize` default 200, `maxPages` default 20
   * @returns {Promise<any[]>}
   */
  async listAllWithApprovals({ pageSize = 200, maxPages = 20, accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const out = [];
    let pageToken;
    for (let i = 0; i < maxPages; i++) {
      const res = await this.listWithApprovals({ pageSize, pageToken, accountSid, authToken, apiKeySid, apiKeySecret });
      const batch = res?.contents || [];
      out.push(...batch);
      const next = res?.meta?.next_page_url;
      if (!next) break;
      const m = /[?&]PageToken=([^&]+)/.exec(next);
      pageToken = m ? decodeURIComponent(m[1]) : null;
      if (!pageToken) break;
    }
    return out;
  }

  /**
   * Submit a Content template for WhatsApp approval.
   * @param {Object} params
   * @param {string} params.contentSid
   * @param {string} params.name      - lowercase alphanumeric + underscores
   * @param {'UTILITY'|'MARKETING'|'AUTHENTICATION'} params.category
   */
  async requestWhatsAppApproval({ contentSid, name, category, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!contentSid || !name || !category) {
      throw new Error('twilio.content.requestWhatsAppApproval: `contentSid`, `name` and `category` are required');
    }
    return this._req({
      method: 'POST', path: `/v1/Content/${contentSid}/ApprovalRequests/whatsapp`,
      json: { name, category },
      accountSid, authToken, apiKeySid, apiKeySecret
    });
  }

  /**
   * Fetch approval status (incl. WhatsApp) for one content SID.
   * @param {Object} params
   * @param {string} params.contentSid
   */
  async fetchApprovals({ contentSid, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!contentSid) throw new Error('twilio.content.fetchApprovals: `contentSid` is required');
    return this._req({
      method: 'GET', path: `/v1/Content/${contentSid}/ApprovalRequests`,
      accountSid, authToken, apiKeySid, apiKeySecret
    });
  }
}

module.exports = { TwilioContentManager, CONTENT_BASE_URL };
