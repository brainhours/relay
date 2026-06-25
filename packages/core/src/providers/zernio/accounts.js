/**
 * ZernioAccountsManager — connected social accounts + Zernio profiles.
 *
 * A "profile" is a Zernio container/workspace (the tenant unit you connect
 * accounts under). An "account" is a single connected social channel
 * (one Instagram, one LinkedIn page, one WhatsApp number, …). Accounts are
 * referenced by their 24-char hex ObjectId throughout the rest of the API.
 *
 * Implements the BaseAccountManager contract (getById / disconnect /
 * getHostedAuthLink) so it interops with the rest of relay-core.
 */
const { BaseAccountManager } = require('../base');

class ZernioAccountsManager extends BaseAccountManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  // ── Accounts ────────────────────────────────────────────────────────────────

  /** List connected accounts. @param {Object} [params] profileId, platform, … */
  list(params = {}) {
    return this.provider.request({ method: 'GET', path: '/accounts', params });
  }

  /** Fetch a connected account by id. */
  get(accountId) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}` });
  }

  /** Update a connected account's settings. */
  update(accountId, body) {
    return this.provider.request({ method: 'PATCH', path: `/accounts/${accountId}`, data: body });
  }

  /** Disconnect/remove a connected account. */
  remove(accountId) {
    return this.provider.request({ method: 'DELETE', path: `/accounts/${accountId}` });
  }

  /** Aggregate health of all accounts. */
  health(params = {}) {
    return this.provider.request({ method: 'GET', path: '/accounts/health', params });
  }

  /** Health/connection status of a single account. */
  accountHealth(accountId) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/health` });
  }

  /** Follower stats across accounts. */
  followerStats(params = {}) {
    return this.provider.request({ method: 'GET', path: '/accounts/follower-stats', params });
  }

  /** Per-account settings. */
  getSettings(accountId) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/settings` });
  }

  /** Update per-account settings. */
  updateSettings(accountId, body) {
    return this.provider.request({ method: 'PATCH', path: `/accounts/${accountId}/settings`, data: body });
  }

  // ── Profiles (workspaces) ─────────────────────────────────────────────────────

  /** List profiles. */
  listProfiles(params = {}) {
    return this.provider.request({ method: 'GET', path: '/profiles', params });
  }

  /** Create a profile. */
  createProfile(body) {
    return this.provider.request({ method: 'POST', path: '/profiles', data: body });
  }

  /** Fetch a profile. */
  getProfile(profileId) {
    return this.provider.request({ method: 'GET', path: `/profiles/${profileId}` });
  }

  /** Update a profile. */
  updateProfile(profileId, body) {
    return this.provider.request({ method: 'PATCH', path: `/profiles/${profileId}`, data: body });
  }

  /** Delete a profile. */
  deleteProfile(profileId) {
    return this.provider.request({ method: 'DELETE', path: `/profiles/${profileId}` });
  }

  /** Account groups. */
  listAccountGroups(params = {}) {
    return this.provider.request({ method: 'GET', path: '/account-groups', params });
  }

  // ── BaseAccountManager contract ───────────────────────────────────────────────

  /** @inheritdoc — delegates to the connect manager's OAuth URL. */
  getHostedAuthLink(options = {}) {
    return this.provider.connect.getConnectUrl(options);
  }

  /** @inheritdoc */
  getById(accountId) {
    return this.get(accountId);
  }

  /** @inheritdoc */
  disconnect(accountId) {
    return this.remove(accountId);
  }
}

module.exports = { ZernioAccountsManager };
