/**
 * Meta WhatsApp Cloud API templates manager.
 *
 * Templates live at the WABA (WhatsApp Business Account) level. All endpoints
 * here require `businessAccountId` (or `templateId` for direct edits/deletes).
 *
 * Status lifecycle: PENDING → APPROVED | REJECTED, then can move to PAUSED |
 * DISABLED | IN_APPEAL via Meta policy. Apps should listen to the
 * TEMPLATE_STATUS_CHANGED webhook (parsed automatically by parseCloudApiWebhook)
 * to react to status changes without polling.
 *
 * @see https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

const DEFAULT_FIELDS = 'id,name,language,category,status,components,quality_score,rejected_reason,parameter_format';

function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class MetaCloudApiTemplateManager {
  constructor(provider) { this.provider = provider; }

  /**
   * Fetch one page of templates.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.businessAccountId
   * @param {number} [params.limit=100]
   * @param {string} [params.after]                 - paging cursor
   * @param {string} [params.fields]                - comma-separated fields
   * @returns {Promise<{ data: any[], paging?: { cursors?: { before?: string, after?: string }, next?: string } }>}
   */
  async list({
    accessToken,
    businessAccountId,
    limit = 100,
    after,
    fields = DEFAULT_FIELDS
  }) {
    return this.provider.request({
      method: 'GET',
      path: `/${businessAccountId}/message_templates`,
      params: omitUndef({ limit, fields, after }),
      accessToken
    });
  }

  /**
   * Auto-paginate through all templates. Returns a flat array.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.businessAccountId
   * @param {string} [params.fields]
   * @returns {Promise<any[]>}
   */
  async listAll({ accessToken, businessAccountId, fields }) {
    const all = [];
    let after;
    // Hard cap to avoid infinite loops on a buggy paging response.
    for (let safety = 0; safety < 200; safety++) {
      const page = await this.list({ accessToken, businessAccountId, limit: 100, after, fields });
      const items = page && page.data ? page.data : [];
      all.push(...items);
      after = page && page.paging && page.paging.cursors && page.paging.cursors.after;
      if (!after || items.length === 0) break;
    }
    return all;
  }

  /**
   * Fetch a template by name (and optional language). Implemented as a filter
   * on `listAll` because Meta does not have a direct lookup-by-name endpoint
   * at the WABA level.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.businessAccountId
   * @param {string} params.name
   * @param {string} [params.language]
   * @returns {Promise<any|null>}
   */
  async get({ accessToken, businessAccountId, name, language }) {
    const all = await this.listAll({ accessToken, businessAccountId });
    return (
      all.find((t) => t.name === name && (!language || t.language === language)) || null
    );
  }

  /**
   * Create a template. Returns Meta's `{ id, status, category }` response.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.businessAccountId
   * @param {string} params.name                    - snake_case, ≤512 chars
   * @param {string} params.language                - e.g. 'pt_BR'
   * @param {'MARKETING'|'UTILITY'|'AUTHENTICATION'} params.category
   * @param {Array}  params.components              - per Meta schema
   * @param {boolean} [params.allowCategoryChange]  - allow Meta to reclassify
   * @returns {Promise<{ id: string, status: string, category: string }>}
   */
  async create({
    accessToken,
    businessAccountId,
    name,
    language,
    category,
    components,
    allowCategoryChange
  }) {
    return this.provider.request({
      method: 'POST',
      path: `/${businessAccountId}/message_templates`,
      accessToken,
      data: omitUndef({
        name,
        language,
        category,
        components,
        allow_category_change: allowCategoryChange
      })
    });
  }

  /**
   * Delete a template. Without `hsmId`, Meta deletes ALL languages of that
   * name. Pass `hsmId` (the template's `id` from list) to delete a specific
   * language version.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.businessAccountId
   * @param {string} params.name
   * @param {string} [params.hsmId]
   */
  async delete({ accessToken, businessAccountId, name, hsmId }) {
    return this.provider.request({
      method: 'DELETE',
      path: `/${businessAccountId}/message_templates`,
      params: omitUndef({ name, hsm_id: hsmId }),
      accessToken
    });
  }

  /**
   * Edit a template. Allowed only on PENDING/REJECTED templates and only
   * once for APPROVED ones (Meta's rules — they may reject; the response
   * tells you).
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.templateId             - the id from list (NOT name)
   * @param {Array}  [params.components]
   * @param {string} [params.category]
   */
  async edit({ accessToken, templateId, components, category }) {
    return this.provider.request({
      method: 'POST',
      path: `/${templateId}`,
      accessToken,
      data: omitUndef({ components, category })
    });
  }
}

module.exports = { MetaCloudApiTemplateManager };
