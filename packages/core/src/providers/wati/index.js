/**
 * Wati Provider - WhatsApp Business messaging via Wati (BSP on the official
 * WhatsApp Cloud API).
 *
 * Multi-tenant: each Wati subscription has its own tenant base URL + Bearer
 * token. The provider is stateless — pass `(apiEndpoint, accessToken)` per call
 * (or set defaults in the constructor for single-tenant usage).
 *
 * @example  Stateless (multi-tenant) usage
 * const { WatiProvider } = require('@guilhermegoulart1/relay-core');
 * const wati = new WatiProvider();
 *
 * await wati.messaging.sendText({
 *   apiEndpoint: 'https://live-mt-server.wati.io/388231',
 *   accessToken: tenant.token,             // 'Bearer ...' optional
 *   number: '5511999999999',
 *   text: 'Olá! Como posso ajudar?',
 *   localMessageId: outboxId               // for echo dedup
 * });
 *
 * // Hand off to a human operator inside the Wati inbox
 * await wati.conversations.assignOperator({
 *   apiEndpoint, accessToken, number: '5511999999999', email: 'agente@empresa.com'
 * });
 *
 * @example  Parse an inbound webhook
 * const { parseWatiWebhook, EventTypes } = require('@guilhermegoulart1/relay-core');
 * const event = parseWatiWebhook(req.body);
 * if (event.type === EventTypes.MESSAGE_RECEIVED) { ...wake the agent... }
 */

const { WatiProvider, normalizeEndpoint, normalizeBearer } = require('./client');
const { WatiMessagingManager } = require('./messaging');
const { WatiContactsManager } = require('./contacts');
const { WatiConversationsManager, VALID_CHAT_STATUSES } = require('./conversations');
const { WatiTemplatesManager } = require('./templates');
const { WatiAccountManager } = require('./account');
const { WatiChatbotsManager } = require('./chatbots');
const {
  parseWatiWebhook,
  validateWatiSignature,
  generateWebhookJobId,
  WATI_EVENT_MAP
} = require('./webhooks');

module.exports = {
  // Main provider
  WatiProvider,

  // Managers (also accessible via provider instance)
  WatiMessagingManager,
  WatiContactsManager,
  WatiConversationsManager,
  WatiTemplatesManager,
  WatiAccountManager,
  WatiChatbotsManager,

  // Webhook utilities
  parseWatiWebhook,
  validateWatiSignature,
  generateWebhookJobId,
  WATI_EVENT_MAP,

  // Constants / helpers
  VALID_CHAT_STATUSES,
  normalizeEndpoint,
  normalizeBearer
};
