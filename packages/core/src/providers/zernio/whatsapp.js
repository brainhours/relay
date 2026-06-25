/**
 * ZernioWhatsAppManager — WhatsApp Business (official Meta Cloud API) specifics.
 *
 * Covers what the generic inbox doesn't: message templates, the Meta template
 * library, business profile, interactive Flows, phone-number provisioning &
 * KYC, calling, the test sandbox, WA groups and block lists. Sending messages
 * into an existing conversation lives in `provider.messaging`; starting a new
 * one (template to a fresh number) is `provider.messaging.createConversation`.
 *
 * Most reads/writes are scoped by `accountId` (a connected WhatsApp account) or
 * `phoneNumberId`, passed as a query param or in the body per the endpoint.
 */
class ZernioWhatsAppManager {
  constructor(provider) {
    this.provider = provider;
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  /** List message templates. */
  listTemplates(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/templates', params });
  }

  /** Create a message template (Meta reviews it). */
  createTemplate(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/templates', data: body });
  }

  /** Get a template by name. */
  getTemplate(templateName, params = {}) {
    return this.provider.request({ method: 'GET', path: `/whatsapp/templates/${encodeURIComponent(templateName)}`, params });
  }

  /** Update a template. */
  updateTemplate(templateName, body) {
    return this.provider.request({ method: 'PATCH', path: `/whatsapp/templates/${encodeURIComponent(templateName)}`, data: body });
  }

  /** Delete a template. */
  deleteTemplate(templateName, params = {}) {
    return this.provider.request({ method: 'DELETE', path: `/whatsapp/templates/${encodeURIComponent(templateName)}`, params });
  }

  /** Browse Meta's pre-approved template library. */
  templateLibrary(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/template-library', params });
  }

  // ── Business profile ────────────────────────────────────────────────────────

  getBusinessProfile(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/business-profile', params });
  }

  updateBusinessProfile(body) {
    return this.provider.request({ method: 'PATCH', path: '/whatsapp/business-profile', data: body });
  }

  updateBusinessProfilePhoto(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/business-profile/photo', data: body });
  }

  updateBusinessDisplayName(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/business-profile/display-name', data: body });
  }

  /** Look up whether a number is on WhatsApp / its info. */
  numberInfo(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/number-info', params });
  }

  // ── Flows (interactive forms) ─────────────────────────────────────────────────

  listFlows(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/flows', params });
  }

  createFlow(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/flows', data: body });
  }

  getFlow(flowId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/whatsapp/flows/${encodeURIComponent(flowId)}`, params });
  }

  updateFlow(flowId, body) {
    return this.provider.request({ method: 'PATCH', path: `/whatsapp/flows/${encodeURIComponent(flowId)}`, data: body });
  }

  deleteFlow(flowId, params = {}) {
    return this.provider.request({ method: 'DELETE', path: `/whatsapp/flows/${encodeURIComponent(flowId)}`, params });
  }

  getFlowJson(flowId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/whatsapp/flows/${encodeURIComponent(flowId)}/json`, params });
  }

  publishFlow(flowId, body = {}) {
    return this.provider.request({ method: 'POST', path: `/whatsapp/flows/${encodeURIComponent(flowId)}/publish`, data: body });
  }

  deprecateFlow(flowId, body = {}) {
    return this.provider.request({ method: 'POST', path: `/whatsapp/flows/${encodeURIComponent(flowId)}/deprecate`, data: body });
  }

  /** Send a published Flow to a recipient. */
  sendFlow(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/flows/send', data: body });
  }

  /** List collected Flow responses. */
  flowResponses(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/flow-responses', params });
  }

  // ── Phone numbers (provisioning / KYC) ─────────────────────────────────────────

  listPhoneNumbers(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/phone-numbers', params });
  }

  getPhoneNumber(phoneNumberId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/whatsapp/phone-numbers/${encodeURIComponent(phoneNumberId)}`, params });
  }

  releasePhoneNumber(phoneNumberId, params = {}) {
    return this.provider.request({ method: 'DELETE', path: `/whatsapp/phone-numbers/${encodeURIComponent(phoneNumberId)}`, params });
  }

  /** Buy a new WhatsApp number through Zernio. */
  purchasePhoneNumber(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/phone-numbers/purchase', data: body });
  }

  availableCountries(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/phone-numbers/countries', params });
  }

  availableNumbers(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/phone-numbers/available', params });
  }

  /** Submit KYC for a purchased number. */
  submitKyc(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/phone-numbers/kyc', data: body });
  }

  // ── Calling ───────────────────────────────────────────────────────────────────

  getCalling(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/calling', params });
  }

  setCalling(body) {
    return this.provider.request({ method: 'PATCH', path: '/whatsapp/calling', data: body });
  }

  placeCall(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/calls', data: body });
  }

  listCalls(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/calls', params });
  }

  // ── Sandbox (testing) ──────────────────────────────────────────────────────────

  listSandboxSessions(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/sandbox/sessions', params });
  }

  createSandboxSession(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/sandbox/sessions', data: body });
  }

  deleteSandboxSession(sessionId) {
    return this.provider.request({ method: 'DELETE', path: `/whatsapp/sandbox/sessions/${encodeURIComponent(sessionId)}` });
  }

  // ── Groups & block list ─────────────────────────────────────────────────────

  listGroups(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/wa-groups', params });
  }

  getGroup(groupId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/whatsapp/wa-groups/${encodeURIComponent(groupId)}`, params });
  }

  groupInviteLink(groupId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/whatsapp/wa-groups/${encodeURIComponent(groupId)}/invite-link`, params });
  }

  listBlockedUsers(params = {}) {
    return this.provider.request({ method: 'GET', path: '/whatsapp/block-users', params });
  }

  blockUsers(body) {
    return this.provider.request({ method: 'POST', path: '/whatsapp/block-users', data: body });
  }
}

module.exports = { ZernioWhatsAppManager };
