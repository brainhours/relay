/**
 * Wati Contacts Manager
 *
 * Contact CRUD + custom-attribute writes + tag semantics.
 *
 * Endpoints (header `Authorization: Bearer <token>`):
 *   GET  /api/v1/getContacts
 *   POST /api/v1/addContact/{whatsappNumber}              - upsert name + customParams
 *   POST /api/v1/updateContactAttributes/{whatsappNumber} - set custom attributes
 *
 * NOTE on "tags": the Wati PUBLIC API (v1 AND v3) does NOT expose a tag-write
 * endpoint — verified across addContact, updateContactAttributes, and the v3
 * contacts add/update models. Native Wati tags come back on contact READS but
 * cannot be written programmatically. The only API-supported way to "flag" a
 * contact so the human team can see and FILTER on it inside the Wati inbox is a
 * custom attribute. `addTag()`/`removeTag()` below implement tag semantics on
 * top of that (one boolean attribute per tag, additive — no read-modify-write).
 *
 * If the client also wants NATIVE Wati tag chips, they set up a one-time Wati
 * no-code automation: "when attribute `tag_<slug>` = true -> add native tag".
 * That bridge lives in the Wati dashboard, not here. If Wati ever ships a real
 * tag-write endpoint, only addTag/removeTag need to change.
 *
 * @see https://docs.wati.io/reference/post_api-v1-updatecontactattributes-whatsappnumber-1
 * @see https://docs.wati.io/reference/post_api-v1-addcontact-whatsappnumber-1
 * @see https://docs.wati.io/reference/get_api-v1-getcontacts-1
 */

/** Default prefix for tag-backing custom attributes. */
const TAG_ATTR_PREFIX = 'tag_';

function cleanNumber(number) {
  return String(number ?? '').replace(/[^\d]/g, '');
}

/**
 * Slugify a human tag name into a safe custom-attribute key suffix.
 * "Lead Qualificado!" -> "lead_qualificado"
 * @private
 */
function tagSlug(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accent combining marks
    .replace(/[^a-z0-9]+/g, '_')       // non-alnum -> underscore
    .replace(/^_+|_+$/g, '');          // trim leading/trailing underscores
}

class WatiContactsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * List contacts (paginated).
   * @param {Object} params
   * @param {number} [params.pageSize]
   * @param {number} [params.pageNumber]
   * @returns {Promise<Object>}
   */
  async getContacts({ apiEndpoint, accessToken, pageSize, pageNumber } = {}) {
    const params = {};
    if (pageSize != null) params.pageSize = pageSize;
    if (pageNumber != null) params.pageNumber = pageNumber;
    return this.provider.request({
      method: 'GET',
      path: '/api/v1/getContacts',
      apiEndpoint,
      accessToken,
      params
    });
  }

  /**
   * Upsert a contact (name + custom attributes).
   * @param {Object} params
   * @param {string} params.number
   * @param {string} [params.name]
   * @param {Array<{name:string,value:string}>} [params.customParams]
   * @returns {Promise<Object>}
   */
  async addContact({ apiEndpoint, accessToken, number, name, customParams } = {}) {
    const wa = cleanNumber(number);
    const data = {};
    if (name != null) data.name = name;
    if (Array.isArray(customParams)) data.customParams = customParams;
    return this.provider.request({
      method: 'POST',
      path: `/api/v1/addContact/${encodeURIComponent(wa)}`,
      apiEndpoint,
      accessToken,
      data
    });
  }

  /**
   * Set/overwrite custom attributes on a contact.
   * @param {Object} params
   * @param {string} params.number
   * @param {Array<{name:string,value:string}>} params.customParams
   * @returns {Promise<Object>}
   */
  async updateContactAttributes({ apiEndpoint, accessToken, number, customParams } = {}) {
    const wa = cleanNumber(number);
    return this.provider.request({
      method: 'POST',
      path: `/api/v1/updateContactAttributes/${encodeURIComponent(wa)}`,
      apiEndpoint,
      accessToken,
      data: { customParams: Array.isArray(customParams) ? customParams : [] }
    });
  }

  /**
   * Set a single custom attribute.
   * @param {Object} params
   * @param {string} params.number
   * @param {string} params.name
   * @param {string} params.value
   * @returns {Promise<Object>}
   */
  async setAttribute({ apiEndpoint, accessToken, number, name, value } = {}) {
    return this.updateContactAttributes({
      apiEndpoint,
      accessToken,
      number,
      customParams: [{ name, value: value == null ? '' : String(value) }]
    });
  }

  /**
   * Add a "tag" to a contact. Implemented as a boolean-ish custom attribute
   * `${prefix}${slug}` = value (default "true") because Wati has no tag-write
   * API. Additive and idempotent.
   * @param {Object} params
   * @param {string} params.number
   * @param {string} params.tag                - human tag name (e.g. "Qualificado")
   * @param {string} [params.value="true"]
   * @param {string} [params.prefix="tag_"]
   * @returns {Promise<Object>}
   */
  async addTag({ apiEndpoint, accessToken, number, tag, value, prefix } = {}) {
    const attr = `${prefix ?? TAG_ATTR_PREFIX}${tagSlug(tag)}`;
    return this.setAttribute({
      apiEndpoint,
      accessToken,
      number,
      name: attr,
      value: value ?? 'true'
    });
  }

  /**
   * Remove a "tag" from a contact (clears the backing attribute).
   * @param {Object} params
   * @param {string} params.number
   * @param {string} params.tag
   * @param {string} [params.prefix="tag_"]
   * @returns {Promise<Object>}
   */
  async removeTag({ apiEndpoint, accessToken, number, tag, prefix } = {}) {
    const attr = `${prefix ?? TAG_ATTR_PREFIX}${tagSlug(tag)}`;
    return this.setAttribute({ apiEndpoint, accessToken, number, name: attr, value: '' });
  }
}

module.exports = { WatiContactsManager, tagSlug, TAG_ATTR_PREFIX };
