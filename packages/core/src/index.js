/**
 * @guilhermegoulart1/relay-core - Unified messaging integrations for Node.js
 *
 * @example
 * const { UnipileProvider, parseWebhook, EventTypes } = require('@guilhermegoulart1/relay-core');
 *
 * // Initialize provider
 * const unipile = new UnipileProvider({
 *   dsn: process.env.UNIPILE_DSN,
 *   accessToken: process.env.UNIPILE_ACCESS_TOKEN
 * });
 *
 * // Send a message
 * await unipile.messaging.send({
 *   account_id: 'acc_123',
 *   user_id: 'user_456',
 *   text: 'Hello from Relay!'
 * });
 *
 * // Handle webhooks
 * app.post('/webhooks/unipile', (req, res) => {
 *   const event = parseWebhook('unipile', req.body);
 *
 *   if (event.type === EventTypes.MESSAGE_RECEIVED) {
 *     console.log('New message:', event.content);
 *   }
 *
 *   res.status(200).send('OK');
 * });
 */

// Providers
const {
  BaseProvider,
  UnipileProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature
} = require('./providers');

// Unipile sub-modules (v1.3.0+)
const {
  UnipilePostsManager,
  UnipileReactionsManager,
  UnipileCommentsManager,
  UnipileCompanyManager,
  UnipileJobsManager,
  REACTION_TYPES
} = require('./providers/unipile');

// Events
const {
  EventTypes,
  ProviderTypes,
  NormalizedEvent,
  MessagingEventEmitter,
  getDefaultEmitter
} = require('./events');

// Queue helpers
const {
  PRIORITY_LEVELS,
  generateJobId,
  getPriority,
  getJobOptions,
  createJobData,
  isBullAvailable,
  createWebhookQueue,
  addWebhookJob,
  isWebhookProcessed,
  createWebhookProcessor
} = require('./queue');

// Utilities
const {
  formatWhatsAppNumber,
  formatPhoneForDisplay,
  extractCountryCode,
  isValidPhoneNumber
} = require('./utils');

module.exports = {
  // Providers
  BaseProvider,
  UnipileProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature,

  // Unipile managers (v1.3.0+)
  UnipilePostsManager,
  UnipileReactionsManager,
  UnipileCommentsManager,
  UnipileCompanyManager,
  UnipileJobsManager,
  REACTION_TYPES,

  // Events
  EventTypes,
  ProviderTypes,
  NormalizedEvent,
  MessagingEventEmitter,
  getDefaultEmitter,

  // Queue helpers
  PRIORITY_LEVELS,
  generateJobId,
  getPriority,
  getJobOptions,
  createJobData,
  isBullAvailable,
  createWebhookQueue,
  addWebhookJob,
  isWebhookProcessed,
  createWebhookProcessor,

  // Utilities
  formatWhatsAppNumber,
  formatPhoneForDisplay,
  extractCountryCode,
  isValidPhoneNumber
};
