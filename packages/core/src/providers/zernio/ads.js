/**
 * ZernioAdsManager — paid ads across Meta, Google, LinkedIn, TikTok, Pinterest
 * and X: campaigns, ad sets, ads, audiences, lead forms, CTWA (Click-to-
 * WhatsApp), conversions and tracking tags.
 *
 * This is the broadest surface in Zernio; methods here are thin wrappers and a
 * generic `request(method, path, ...)` escape hatch is provided for endpoints
 * not wrapped explicitly. Connecting an ad account lives in
 * `provider.connect.getAdsConnectUrl()`.
 */
class ZernioAdsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /** Generic ads request — `path` is relative to `/ads`. */
  request(method, path, { params, data } = {}) {
    return this.provider.request({ method, path: `/ads${path}`, params, data });
  }

  // ── Ads ─────────────────────────────────────────────────────────────────────
  list(params = {}) { return this.request('GET', '', { params }); }
  get(adId) { return this.request('GET', `/${adId}`); }
  update(adId, body) { return this.request('PATCH', `/${adId}`, { data: body }); }
  delete(adId) { return this.request('DELETE', `/${adId}`); }
  /** Create an ad (full builder body). */
  create(body) { return this.request('POST', '/create', { data: body }); }
  /** Boost an existing organic post into an ad. */
  boost(body) { return this.request('POST', '/boost', { data: body }); }
  analytics(adId, params = {}) { return this.request('GET', `/${adId}/analytics`, { params }); }
  adComments(adId, params = {}) { return this.request('GET', `/${adId}/comments`, { params }); }

  // ── Campaigns / ad sets ────────────────────────────────────────────────────────
  listCampaigns(params = {}) { return this.request('GET', '/campaigns', { params }); }
  getCampaign(campaignId) { return this.request('GET', `/campaigns/${campaignId}`); }
  setCampaignStatus(campaignId, body) { return this.request('PATCH', `/campaigns/${campaignId}/status`, { data: body }); }
  duplicateCampaign(campaignId, body = {}) { return this.request('POST', `/campaigns/${campaignId}/duplicate`, { data: body }); }
  getAdSet(adSetId) { return this.request('GET', `/ad-sets/${adSetId}`); }
  setAdSetStatus(adSetId, body) { return this.request('PATCH', `/ad-sets/${adSetId}/status`, { data: body }); }
  tree(params = {}) { return this.request('GET', '/tree', { params }); }
  timeline(params = {}) { return this.request('GET', '/timeline', { params }); }
  businessCenters(params = {}) { return this.request('GET', '/business-centers', { params }); }
  adAccounts(params = {}) { return this.request('GET', '/accounts', { params }); }

  // ── Audiences ──────────────────────────────────────────────────────────────────
  listAudiences(params = {}) { return this.request('GET', '/audiences', { params }); }
  createAudience(body) { return this.request('POST', '/audiences', { data: body }); }
  getAudience(audienceId) { return this.request('GET', `/audiences/${audienceId}`); }
  deleteAudience(audienceId) { return this.request('DELETE', `/audiences/${audienceId}`); }
  uploadAudienceUsers(audienceId, body) { return this.request('POST', `/audiences/${audienceId}/users`, { data: body }); }

  // ── Targeting / catalogs ─────────────────────────────────────────────────────
  interests(params = {}) { return this.request('GET', '/interests', { params }); }
  searchTargeting(params = {}) { return this.request('GET', '/targeting/search', { params }); }
  reachEstimate(params = {}) { return this.request('GET', '/targeting/reach-estimate', { params }); }
  catalogs(params = {}) { return this.request('GET', '/catalogs', { params }); }

  // ── Lead forms ─────────────────────────────────────────────────────────────────
  leads(params = {}) { return this.request('GET', '/leads', { params }); }
  leadForms(params = {}) { return this.request('GET', '/lead-forms', { params }); }
  getLeadForm(formId) { return this.request('GET', `/lead-forms/${formId}`); }
  leadFormLeads(formId, params = {}) { return this.request('GET', `/lead-forms/${formId}/leads`, { params }); }

  // ── Conversions / CTWA ──────────────────────────────────────────────────────────
  listConversions(params = {}) { return this.request('GET', '/conversions', { params }); }
  createConversion(body) { return this.request('POST', '/conversions', { data: body }); }
  conversionQuality(params = {}) { return this.request('GET', '/conversions/quality', { params }); }
  /** Click-to-WhatsApp ads. */
  ctwa(params = {}) { return this.request('GET', '/ctwa', { params }); }

  // ── Tracking tags (account-scoped) ─────────────────────────────────────────────
  listTrackingTags(accountId, params = {}) { return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/tracking-tags`, params }); }
  createTrackingTag(accountId, body) { return this.provider.request({ method: 'POST', path: `/accounts/${accountId}/tracking-tags`, data: body }); }
  getTrackingTag(accountId, tagId) { return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/tracking-tags/${tagId}` }); }
  updateTrackingTag(accountId, tagId, body) { return this.provider.request({ method: 'PATCH', path: `/accounts/${accountId}/tracking-tags/${tagId}`, data: body }); }
  deleteTrackingTag(accountId, tagId) { return this.provider.request({ method: 'DELETE', path: `/accounts/${accountId}/tracking-tags/${tagId}` }); }
  trackingTagStats(accountId, tagId, params = {}) { return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/tracking-tags/${tagId}/stats`, params }); }
}

module.exports = { ZernioAdsManager };
