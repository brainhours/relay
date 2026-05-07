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
  UazapiProvider,
  WebchatProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature
} = require('./providers');

// Webchat sub-modules (v1.9.0+)
const {
  WebchatMessagingManager,
  createWebchatHandler,
  WebchatStorageAdapter,
  WebchatRealtimeAdapter,
  SSERealtimeAdapter,
  InMemoryWebchatStorage,
  parseWebchatWebhook,
  validateWebchatSignature,
  generateWebhookJobId: generateWebchatWebhookJobId,
  generateVisitorToken,
  isValidVisitorTokenFormat
} = require('./providers/webchat');

// Unipile sub-modules (v1.3.0+)
const {
  UnipilePostsManager,
  UnipileReactionsManager,
  UnipileCommentsManager,
  UnipileCompanyManager,
  UnipileJobsManager,
  REACTION_TYPES
} = require('./providers/unipile');

// Uazapi sub-modules (v1.8.0+)
const {
  UazapiServerPool,
  UazapiInstanceManager,
  UazapiMessagingManager,
  UazapiChatsManager,
  UazapiContactsManager,
  UazapiMessagesManager,
  UazapiGroupsManager,
  UazapiProfileManager,
  UazapiWebhookManager,
  parseUazapiWebhook,
  validateUazapiSignature,
  generateWebhookJobId: generateUazapiWebhookJobId,
  UAZAPI_EVENT_MAP
} = require('./providers/uazapi');

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
  UazapiProvider,
  WebchatProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature,

  // Webchat (v1.9.0+)
  WebchatMessagingManager,
  createWebchatHandler,
  WebchatStorageAdapter,
  WebchatRealtimeAdapter,
  SSERealtimeAdapter,
  InMemoryWebchatStorage,
  parseWebchatWebhook,
  validateWebchatSignature,
  generateWebchatWebhookJobId,
  generateVisitorToken,
  isValidVisitorTokenFormat,

  // Unipile managers (v1.3.0+)
  UnipilePostsManager,
  UnipileReactionsManager,
  UnipileCommentsManager,
  UnipileCompanyManager,
  UnipileJobsManager,
  REACTION_TYPES,

  // Uazapi managers + utilities (v1.8.0+)
  UazapiServerPool,
  UazapiInstanceManager,
  UazapiMessagingManager,
  UazapiChatsManager,
  UazapiContactsManager,
  UazapiMessagesManager,
  UazapiGroupsManager,
  UazapiProfileManager,
  UazapiWebhookManager,
  parseUazapiWebhook,
  validateUazapiSignature,
  generateUazapiWebhookJobId,
  UAZAPI_EVENT_MAP,

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
