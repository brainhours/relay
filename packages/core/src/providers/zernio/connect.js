/**
 * ZernioConnectManager — account connection flows for every channel.
 *
 * Standard OAuth (recommended for end-clients): call `getConnectUrl()` to get an
 * `authUrl`, redirect the user there. Zernio hosts the selection UI and Meta/etc
 * host the consent + (for WhatsApp) the Embedded Signup picker; on completion the
 * user is sent back to your `redirect_url` with `?connected=…&accountId=…`.
 *
 * Headless OAuth (custom UI): pass `headless: true` — the user comes back to your
 * `redirect_url` with raw OAuth `code`/`state`; you then call the matching
 * selection endpoint (selectFacebookPage / selectLinkedInOrganization / …) to
 * finish.
 *
 * WhatsApp specifically supports THREE paths (see docs):
 *   1. Embedded Signup (redirect)  → getConnectUrl({ platform: 'whatsapp', … })
 *   2. Headless credentials        → connectWhatsAppCredentials({ … })  (System User token)
 *   3. Dashboard (Zernio UI)       → no API needed
 */
class ZernioConnectManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Start an OAuth connect flow; returns `{ authUrl, state }`.
   * @param {Object} params
   * @param {string} params.platform     - facebook|instagram|linkedin|twitter|tiktok|youtube|threads|reddit|pinterest|bluesky|googlebusiness|telegram|snapchat|discord|whatsapp
   * @param {string} params.profileId    - target Zernio profile id
   * @param {string} [params.redirectUrl] - your callback URL (alias: redirect_url)
   * @param {boolean} [params.headless]   - return raw OAuth data instead of Zernio's UI
   * @returns {Promise<{authUrl:string, state:string}>}
   */
  getConnectUrl({ platform, profileId, redirectUrl, redirect_url, headless } = {}) {
    if (!platform) throw new Error('zernio.connect.getConnectUrl: `platform` is required');
    if (!profileId) throw new Error('zernio.connect.getConnectUrl: `profileId` is required');
    const params = { profileId, headless };
    const cb = redirectUrl || redirect_url;
    if (cb) params.redirect_url = cb;
    return this.provider.request({ method: 'GET', path: `/connect/${platform}`, params });
  }

  /**
   * Complete an OAuth callback (exchange code → tokens, attach account).
   * @param {string} platform
   * @param {Object} body - { code, state, profileId }
   */
  completeOAuth(platform, body) {
    return this.provider.request({ method: 'POST', path: `/connect/${platform}`, data: body });
  }

  /** Fetch pending OAuth data (headless flows that need a follow-up selection). */
  pendingData(params = {}) {
    return this.provider.request({ method: 'GET', path: '/connect/pending-data', params });
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────────

  /**
   * Connect WhatsApp via Meta credentials directly (headless; no browser).
   * Use when you already hold a System User permanent token. Prefer
   * getConnectUrl({platform:'whatsapp'}) (Embedded Signup) for end-clients.
   * @param {Object} body - { profileId, accessToken, wabaId, phoneNumberId }
   */
  connectWhatsAppCredentials(body) {
    return this.provider.request({ method: 'POST', path: '/connect/whatsapp/credentials', data: body });
  }

  /** Pick which WABA phone number to connect (multi-number accounts). */
  selectWhatsAppPhoneNumber(body) {
    return this.provider.request({ method: 'POST', path: '/connect/whatsapp/select-phone-number', data: body });
  }

  // ── Per-platform selection (headless follow-ups) ───────────────────────────────

  /** Facebook: choose which Page to connect. */
  selectFacebookPage(body) {
    return this.provider.request({ method: 'POST', path: '/connect/facebook/select-page', data: body });
  }

  /** LinkedIn: list organizations the user can manage. */
  listLinkedInOrganizations(params = {}) {
    return this.provider.request({ method: 'GET', path: '/connect/linkedin/organizations', params });
  }

  /** LinkedIn: choose org (or personal) to connect. */
  selectLinkedInOrganization(body) {
    return this.provider.request({ method: 'POST', path: '/connect/linkedin/select-organization', data: body });
  }

  /** Pinterest: choose a board. */
  selectPinterestBoard(body) {
    return this.provider.request({ method: 'POST', path: '/connect/pinterest/select-board', data: body });
  }

  /** Snapchat: choose a profile. */
  selectSnapchatProfile(body) {
    return this.provider.request({ method: 'POST', path: '/connect/snapchat/select-profile', data: body });
  }

  /** Google Business: list manageable locations. */
  listGoogleBusinessLocations(params = {}) {
    return this.provider.request({ method: 'GET', path: '/connect/googlebusiness/locations', params });
  }

  /** Google Business: choose a location. */
  selectGoogleBusinessLocation(body) {
    return this.provider.request({ method: 'POST', path: '/connect/googlebusiness/select-location', data: body });
  }

  /** Bluesky: connect via app-password credentials. */
  connectBlueskyCredentials(body) {
    return this.provider.request({ method: 'POST', path: '/connect/bluesky/credentials', data: body });
  }

  /** Telegram: connect a bot/channel. */
  connectTelegram(body) {
    return this.provider.request({ method: 'POST', path: '/connect/telegram', data: body });
  }

  // ── Ads connections ─────────────────────────────────────────────────────────

  /** Start an Ads OAuth connect for a platform (meta/google/linkedin/tiktok/pinterest/x). */
  getAdsConnectUrl({ platform, profileId, redirectUrl, redirect_url } = {}) {
    const params = { profileId };
    const cb = redirectUrl || redirect_url;
    if (cb) params.redirect_url = cb;
    return this.provider.request({ method: 'GET', path: `/connect/${platform}/ads`, params });
  }

  /** Complete TikTok Ads connection. */
  connectTikTokAds(body) {
    return this.provider.request({ method: 'POST', path: '/connect/tiktok-ads', data: body });
  }
}

module.exports = { ZernioConnectManager };
