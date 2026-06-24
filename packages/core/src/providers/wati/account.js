/**
 * Wati Account Manager
 *
 * Tenant-level reads: the connected WhatsApp numbers (a Wati account can hold up
 * to ~25 numbers) and business accounts. Used by the consumer to let the user
 * pick WHICH number a channel maps to — each number is routed via
 * `channelPhoneNumber` on send.
 *
 * Endpoints (header `Authorization: Bearer <token>`):
 *   GET /api/v1/whatsApp/phoneNumbers   - connected numbers (rich per-number data)
 *   GET /api/v1/whatsApp/businessAccounts
 *
 * Per-number shape (result[]):
 *   { phoneId, displayPhoneNumber, verifiedName, wabaId, status, qualityRating,
 *     messagingLimitTier, accountMode, ... }
 *   `displayPhoneNumber` is the value passed as `channelPhoneNumber` when sending
 *   from that specific number.
 *
 * @see https://docs.wati.io/reference/get_api-v1-whatsapp-phonenumbers-1
 */

class WatiAccountManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * List the WhatsApp numbers connected to the tenant.
   * @param {Object} params
   * @param {string} [params.apiEndpoint]
   * @param {string} [params.accessToken]
   * @returns {Promise<Object>} { ok, result: [{ phoneId, displayPhoneNumber, verifiedName, wabaId, status, qualityRating, messagingLimitTier, ... }] }
   */
  async getPhoneNumbers({ apiEndpoint, accessToken } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/api/v1/whatsApp/phoneNumbers',
      apiEndpoint,
      accessToken
    });
  }

  /**
   * List the WhatsApp numbers via the v2 endpoint (multi-number, across WABAs).
   * Returns a TOP-LEVEL ARRAY (no wrapper). Per-number shape:
   *   { channelType, wabaId, phoneNumber, phoneNumberId, channelId, channelName, bmId, ... }
   * Note: on some tenants the v1 /whatsApp/phoneNumbers returns [] while this v2
   * one has the numbers — so consumers should try v2 first, v1 as fallback.
   * @param {Object} params
   * @returns {Promise<Array>}
   */
  async getPhoneNumbersV2({ apiEndpoint, accessToken } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/api/v2/whatsapp/phoneNumbers',
      apiEndpoint,
      accessToken
    });
  }

  /**
   * List the WhatsApp Business Accounts (WABAs) of the tenant.
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async getBusinessAccounts({ apiEndpoint, accessToken } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/api/v1/whatsApp/businessAccounts',
      apiEndpoint,
      accessToken
    });
  }
}

module.exports = { WatiAccountManager };
