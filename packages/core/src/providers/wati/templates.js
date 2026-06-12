/**
 * Wati Templates Manager
 *
 * Read-only access to the tenant's approved WhatsApp message templates. Template
 * authoring/management lives in the Wati dashboard — we only LIST them so a UI
 * (e.g. the agent builder's "send template" node) can offer a picker of the
 * templates that already exist, and so the consumer can resolve a template's
 * placeholders before calling messaging.sendTemplate().
 *
 * Endpoint (header `Authorization: Bearer <token>`):
 *   GET /api/v1/getMessageTemplates
 *
 * Response shape (per template):
 *   { id, elementName, category, status, language:{key,value,text}, type,
 *     header, body, bodyOriginal, footer, buttons[], buttonsType }
 *   Only `status === 'APPROVED'` templates are actually sendable.
 *
 * @see https://docs.wati.io/reference/get_api-v1-getmessagetemplates-1
 */

class WatiTemplatesManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * List message templates (paginated).
   * @param {Object} params
   * @param {number} [params.pageSize]
   * @param {number} [params.pageNumber]
   * @param {string} [params.channelPhoneNumber]
   * @returns {Promise<Object>} { result, messageTemplates: [...], link }
   */
  async getTemplates({ apiEndpoint, accessToken, pageSize, pageNumber, channelPhoneNumber } = {}) {
    const params = {};
    if (pageSize != null) params.pageSize = pageSize;
    if (pageNumber != null) params.pageNumber = pageNumber;
    if (channelPhoneNumber) params.channelPhoneNumber = channelPhoneNumber;
    return this.provider.request({
      method: 'GET',
      path: '/api/v1/getMessageTemplates',
      apiEndpoint,
      accessToken,
      params
    });
  }
}

module.exports = { WatiTemplatesManager };
