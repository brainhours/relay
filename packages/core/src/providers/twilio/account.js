/**
 * Twilio account/admin manager.
 *
 * Account- and number-level introspection. None of these send messages; they
 * help apps verify connectivity and surface admin info (great for setup
 * screens and health checks).
 *
 *   - getAccount         : the Account resource (status, type, friendly name)
 *   - listPhoneNumbers   : IncomingPhoneNumbers under the account
 *   - listMessagingServices : Messaging Services (separate messaging.twilio.com base)
 *   - listSubaccounts    : subaccounts (multi-tenant)
 *   - verifyConnection   : one-call credential/health check
 *
 * @see https://www.twilio.com/docs/iam/api/account
 * @see https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
 */

const MESSAGING_BASE_URL = 'https://messaging.twilio.com';

class TwilioAccountManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Fetch the Account resource.
   * @param {Object} [params]
   * @param {string} [params.accountSid]
   */
  async getAccount({ accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const sid = accountSid || this.provider.accountSid;
    return this.provider.request({
      method: 'GET',
      // Account resource lives at /2010-04-01/Accounts/{Sid}.json (not nested).
      absoluteUrl: `${this.provider.baseUrl}/2010-04-01/Accounts/${sid}.json`,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * List phone numbers owned by the account.
   * @param {Object} [params]
   * @param {string} [params.phoneNumber]             - filter by exact/partial number
   * @param {number} [params.pageSize=50]
   * @returns {Promise<{ incoming_phone_numbers: any[], ... }>}
   */
  async listPhoneNumbers({ phoneNumber, pageSize = 50, accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const params = {};
    if (phoneNumber) params.PhoneNumber = phoneNumber;
    params.PageSize = pageSize;
    return this.provider.request({
      method: 'GET',
      path: '/IncomingPhoneNumbers.json',
      params,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * List Messaging Services. These live on the `messaging.twilio.com` base
   * (a different host than the 2010-04-01 REST API) and are NOT account-scoped
   * in the path.
   * @param {Object} [params]
   * @param {number} [params.pageSize=50]
   * @returns {Promise<{ services: any[], ... }>}
   */
  async listMessagingServices({ pageSize = 50, accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    return this.provider.request({
      method: 'GET',
      baseUrl: MESSAGING_BASE_URL,
      accountScoped: false,
      path: `/v1/Services?PageSize=${encodeURIComponent(pageSize)}`,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * List subaccounts (multi-tenant). Each subaccount has its own SID + Auth
   * Token you can pass per-call.
   * @param {Object} [params]
   * @param {'active'|'suspended'|'closed'} [params.status]
   * @param {number} [params.pageSize=50]
   */
  async listSubaccounts({ status, pageSize = 50, accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const params = { PageSize: pageSize };
    if (status) params.Status = status;
    return this.provider.request({
      method: 'GET',
      absoluteUrl: `${this.provider.baseUrl}/2010-04-01/Accounts.json`,
      params,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * End-to-end connectivity check. Fetches the Account resource; if it
   * succeeds, the credentials are valid. Throws TwilioApiError otherwise.
   *
   * Returns `{ ok, sid, friendlyName, status, type }`.
   *
   * @param {Object} [params]
   * @param {string} [params.accountSid]
   */
  async verifyConnection({ accountSid, authToken, apiKeySid, apiKeySecret } = {}) {
    const acct = await this.getAccount({ accountSid, authToken, apiKeySid, apiKeySecret });
    return {
      ok: true,
      sid: acct.sid,
      friendlyName: acct.friendly_name,
      status: acct.status, // 'active' | 'suspended' | 'closed'
      type: acct.type // 'Full' | 'Trial'
    };
  }
}

module.exports = { TwilioAccountManager, MESSAGING_BASE_URL };
