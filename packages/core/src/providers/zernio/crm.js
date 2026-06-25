/**
 * ZernioCrmManager — contacts, custom fields, broadcasts, sequences, workflows
 * and comment automations (Zernio's lightweight CRM + automation layer).
 *
 * Grouped by entity. All thin wrappers over the unified REST surface.
 */
class ZernioCrmManager {
  constructor(provider) {
    this.provider = provider;
  }

  // ── Contacts ────────────────────────────────────────────────────────────────
  listContacts(params = {}) { return this.provider.request({ method: 'GET', path: '/contacts', params }); }
  createContact(body) { return this.provider.request({ method: 'POST', path: '/contacts', data: body }); }
  getContact(contactId) { return this.provider.request({ method: 'GET', path: `/contacts/${contactId}` }); }
  updateContact(contactId, body) { return this.provider.request({ method: 'PATCH', path: `/contacts/${contactId}`, data: body }); }
  deleteContact(contactId) { return this.provider.request({ method: 'DELETE', path: `/contacts/${contactId}` }); }
  bulkContacts(body) { return this.provider.request({ method: 'POST', path: '/contacts/bulk', data: body }); }
  contactChannels(contactId, params = {}) { return this.provider.request({ method: 'GET', path: `/contacts/${contactId}/channels`, params }); }
  setContactField(contactId, slug, body) { return this.provider.request({ method: 'PATCH', path: `/contacts/${contactId}/fields/${encodeURIComponent(slug)}`, data: body }); }

  // ── Custom fields ─────────────────────────────────────────────────────────────
  listCustomFields(params = {}) { return this.provider.request({ method: 'GET', path: '/custom-fields', params }); }
  createCustomField(body) { return this.provider.request({ method: 'POST', path: '/custom-fields', data: body }); }
  updateCustomField(fieldId, body) { return this.provider.request({ method: 'PATCH', path: `/custom-fields/${fieldId}`, data: body }); }
  deleteCustomField(fieldId) { return this.provider.request({ method: 'DELETE', path: `/custom-fields/${fieldId}` }); }

  // ── Broadcasts ────────────────────────────────────────────────────────────────
  listBroadcasts(params = {}) { return this.provider.request({ method: 'GET', path: '/broadcasts', params }); }
  createBroadcast(body) { return this.provider.request({ method: 'POST', path: '/broadcasts', data: body }); }
  getBroadcast(broadcastId) { return this.provider.request({ method: 'GET', path: `/broadcasts/${broadcastId}` }); }
  sendBroadcast(broadcastId, body = {}) { return this.provider.request({ method: 'POST', path: `/broadcasts/${broadcastId}/send`, data: body }); }
  scheduleBroadcast(broadcastId, body) { return this.provider.request({ method: 'POST', path: `/broadcasts/${broadcastId}/schedule`, data: body }); }
  cancelBroadcast(broadcastId, body = {}) { return this.provider.request({ method: 'POST', path: `/broadcasts/${broadcastId}/cancel`, data: body }); }
  broadcastRecipients(broadcastId, params = {}) { return this.provider.request({ method: 'GET', path: `/broadcasts/${broadcastId}/recipients`, params }); }

  // ── Sequences ─────────────────────────────────────────────────────────────────
  listSequences(params = {}) { return this.provider.request({ method: 'GET', path: '/sequences', params }); }
  createSequence(body) { return this.provider.request({ method: 'POST', path: '/sequences', data: body }); }
  getSequence(sequenceId) { return this.provider.request({ method: 'GET', path: `/sequences/${sequenceId}` }); }
  updateSequence(sequenceId, body) { return this.provider.request({ method: 'PATCH', path: `/sequences/${sequenceId}`, data: body }); }
  deleteSequence(sequenceId) { return this.provider.request({ method: 'DELETE', path: `/sequences/${sequenceId}` }); }
  activateSequence(sequenceId, body = {}) { return this.provider.request({ method: 'POST', path: `/sequences/${sequenceId}/activate`, data: body }); }
  pauseSequence(sequenceId, body = {}) { return this.provider.request({ method: 'POST', path: `/sequences/${sequenceId}/pause`, data: body }); }
  enrollInSequence(sequenceId, body) { return this.provider.request({ method: 'POST', path: `/sequences/${sequenceId}/enroll`, data: body }); }
  sequenceEnrollments(sequenceId, params = {}) { return this.provider.request({ method: 'GET', path: `/sequences/${sequenceId}/enrollments`, params }); }

  // ── Workflows ─────────────────────────────────────────────────────────────────
  listWorkflows(params = {}) { return this.provider.request({ method: 'GET', path: '/workflows', params }); }
  createWorkflow(body) { return this.provider.request({ method: 'POST', path: '/workflows', data: body }); }
  getWorkflow(workflowId) { return this.provider.request({ method: 'GET', path: `/workflows/${workflowId}` }); }
  updateWorkflow(workflowId, body) { return this.provider.request({ method: 'PATCH', path: `/workflows/${workflowId}`, data: body }); }
  deleteWorkflow(workflowId) { return this.provider.request({ method: 'DELETE', path: `/workflows/${workflowId}` }); }
  activateWorkflow(workflowId, body = {}) { return this.provider.request({ method: 'POST', path: `/workflows/${workflowId}/activate`, data: body }); }
  pauseWorkflow(workflowId, body = {}) { return this.provider.request({ method: 'POST', path: `/workflows/${workflowId}/pause`, data: body }); }
  workflowExecutions(workflowId, params = {}) { return this.provider.request({ method: 'GET', path: `/workflows/${workflowId}/executions`, params }); }

  // ── Comment automations (keyword → DM, etc.) ───────────────────────────────────
  listCommentAutomations(params = {}) { return this.provider.request({ method: 'GET', path: '/comment-automations', params }); }
  createCommentAutomation(body) { return this.provider.request({ method: 'POST', path: '/comment-automations', data: body }); }
  updateCommentAutomation(automationId, body) { return this.provider.request({ method: 'PATCH', path: `/comment-automations/${automationId}`, data: body }); }
  deleteCommentAutomation(automationId) { return this.provider.request({ method: 'DELETE', path: `/comment-automations/${automationId}` }); }
  commentAutomationLogs(automationId, params = {}) { return this.provider.request({ method: 'GET', path: `/comment-automations/${automationId}/logs`, params }); }
}

module.exports = { ZernioCrmManager };
