/**
 * Meta WhatsApp Cloud API account/admin manager.
 *
 * Phone-number- and WABA-level operations: introspection, listing, and
 * registration helpers. None of these send messages; they help apps verify
 * connectivity and surface admin info.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers
 */

const DEFAULT_PHONE_FIELDS =
  'id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,throughput,certificate,platform_type';
const DEFAULT_WABA_FIELDS =
  'id,name,timezone_id,message_template_namespace,currency,owner_business_info,business_verification_status,country';

function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class MetaCloudApiAccountManager {
  constructor(provider) { this.provider = provider; }

  /**
   * Get info for a single phone number.
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   * @param {string} [params.fields]
   */
  async getPhoneNumber({ accessToken, phoneNumberId, fields = DEFAULT_PHONE_FIELDS }) {
    return this.provider.request({
      method: 'GET',
      path: `/${phoneNumberId}`,
      params: { fields },
      accessToken
    });
  }

  /**
   * List all phone numbers under a WABA.
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.businessAccountId
   * @param {string} [params.fields]
   * @returns {Promise<{ data: any[] }>}
   */
  async listPhoneNumbers({ accessToken, businessAccountId, fields = DEFAULT_PHONE_FIELDS }) {
    return this.provider.request({
      method: 'GET',
      path: `/${businessAccountId}/phone_numbers`,
      params: { fields },
      accessToken
    });
  }

  /**
   * Get WABA info.
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.businessAccountId
   * @param {string} [params.fields]
   */
  async getBusinessAccount({ accessToken, businessAccountId, fields = DEFAULT_WABA_FIELDS }) {
    return this.provider.request({
      method: 'GET',
      path: `/${businessAccountId}`,
      params: { fields },
      accessToken
    });
  }

  /**
   * Register a phone number (post-PIN-verification). This is a rare op typically
   * needed only on first connect or when migrating a number.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   * @param {string} params.pin                  - 6-digit PIN
   * @param {string} [params.dataLocalizationRegion]
   */
  async register({ accessToken, phoneNumberId, pin, dataLocalizationRegion }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/register`,
      accessToken,
      data: omitUndef({
        messaging_product: 'whatsapp',
        pin,
        data_localization_region: dataLocalizationRegion
      })
    });
  }

  /**
   * De-register a phone number.
   */
  async deregister({ accessToken, phoneNumberId }) {
    return this.provider.request({
      method: 'POST',
      path: `/${phoneNumberId}/deregister`,
      accessToken,
      data: {}
    });
  }

  /**
   * End-to-end connectivity check. Calls getPhoneNumber under the hood; if it
   * succeeds, credentials are valid and the phone number is reachable.
   *
   * Returns `{ ok: true, displayPhoneNumber, verifiedName, qualityRating, tier }`.
   * Throws MetaApiError on failure (auth invalid, phone not found, etc.).
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.phoneNumberId
   */
  async verifyConnection({ accessToken, phoneNumberId }) {
    const info = await this.getPhoneNumber({
      accessToken,
      phoneNumberId,
      fields: 'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier'
    });
    return {
      ok: true,
      id: info.id,
      displayPhoneNumber: info.display_phone_number,
      verifiedName: info.verified_name,
      qualityRating: info.quality_rating,
      tier: info.messaging_limit_tier
    };
  }
}

module.exports = { MetaCloudApiAccountManager };
