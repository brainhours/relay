/**
 * Uazapi Contacts Manager
 *
 * Endpoints:
 *   GET  /contacts          - WhatsApp address book (lightweight)
 *   POST /contacts/list     - paginated, with scope filter
 *   POST /contact/add       - add to address book
 *   POST /contact/remove    - remove from address book
 */

function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class UazapiContactsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Lightweight contacts list (GET).
   * @param {Object} [params]
   * @param {string} [params.token]
   * @param {string} [params.serverId]
   * @param {'address_book'|'outside_address_book'|'all'} [params.contactScope]
   * @returns {Promise<Object>}
   */
  async list({ token, serverId, contactScope } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/contacts',
      params: omitUndef({ contactScope }),
      token,
      serverId
    });
  }

  /**
   * Paginated contacts list with scope filter.
   * @param {Object} params
   * @param {number} [params.limit]
   * @param {number} [params.offset]
   * @param {'address_book'|'outside_address_book'|'all'} [params.contactScope]
   */
  async listPaginated({ token, serverId, limit, offset, contactScope } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/contacts/list',
      token,
      serverId,
      data: omitUndef({ limit, offset, contactScope })
    });
  }

  /**
   * Add a contact to the WhatsApp address book.
   * @param {Object} params
   * @param {string} params.number
   * @param {string} params.name
   */
  async add({ token, serverId, number, name } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/contact/add',
      token,
      serverId,
      data: { number, name }
    });
  }

  /**
   * Remove a contact from the WhatsApp address book.
   * @param {Object} params
   * @param {string} params.number
   */
  async remove({ token, serverId, number } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/contact/remove',
      token,
      serverId,
      data: { number }
    });
  }
}

module.exports = { UazapiContactsManager };
