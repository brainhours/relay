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
  MetaCloudApiProvider,
  WatiProvider,
  TwilioProvider,
  ZernioProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature
} = require('./providers');

// Zernio (Social Media API — publishing + social inbox + ads, 15 channels)
const {
  ZernioPostsManager,
  ZernioMediaManager,
  ZernioAccountsManager,
  ZernioConnectManager,
  ZernioMessagingManager,
  ZernioCommentsManager,
  ZernioReviewsManager,
  ZernioWhatsAppManager,
  ZernioAnalyticsManager,
  ZernioCrmManager,
  ZernioAdsManager,
  ZernioEngagementManager,
  ZernioWebhooksManager,
  ZernioApiError,
  ZERNIO_ERROR_CODES,
  isRetryable: isZernioRetryable,
  parseZernioWebhook,
  validateZernioSignature,
  generateWebhookJobId: generateZernioWebhookJobId,
  ZERNIO_EVENT_MAP,
  ZERNIO_WEBHOOK_EVENTS,
  PLATFORM_TO_PROVIDER_TYPE: ZERNIO_PLATFORM_TO_PROVIDER_TYPE
} = require('./providers/zernio');

// Twilio (SMS / MMS / WhatsApp) sub-modules (v1.18.0+)
const {
  TwilioMessagingManager,
  TwilioMediaManager,
  TwilioAccountManager,
  TwilioApiError,
  TWILIO_ERROR_CODES,
  isRetryable: isTwilioRetryable,
  parseTwilioWebhook,
  validateTwilioSignature,
  computeTwilioSignature,
  generateWebhookJobId: generateTwilioWebhookJobId,
  TWILIO_STATUS_MAP,
  messagingResponse,
  emptyMessagingResponse,
  redirectResponse,
  toChannelAddress,
  parseChannelAddress,
  TwilioConnectManager,
  buildConnectAuthorizeUrl: buildTwilioConnectAuthorizeUrl,
  parseConnectCallback: parseTwilioConnectCallback,
  parseConnectDeauthorize: parseTwilioConnectDeauthorize,
  CONNECT_AUTHORIZE_BASE_URL: TWILIO_CONNECT_AUTHORIZE_BASE_URL,
  TwilioContentManager
} = require('./providers/twilio');

// Wati (WhatsApp Business / BSP) sub-modules
const {
  WatiMessagingManager,
  WatiContactsManager,
  WatiConversationsManager,
  WatiTemplatesManager,
  WatiAccountManager,
  WatiChatbotsManager,
  parseWatiWebhook,
  validateWatiSignature,
  generateWebhookJobId: generateWatiWebhookJobId,
  WATI_EVENT_MAP,
  VALID_CHAT_STATUSES: WATI_VALID_CHAT_STATUSES
} = require('./providers/wati');

// Cloud API (Meta WhatsApp official) sub-modules (v1.10.0+)
const {
  MetaCloudApiMessagingManager,
  MetaCloudApiTemplateManager,
  MetaCloudApiMediaManager,
  MetaCloudApiAccountManager,
  MetaApiError,
  META_ERROR_CODES,
  isRetryable: isCloudApiRetryable,
  parseCloudApiWebhook,
  validateCloudApiSignature,
  generateWebhookJobId: generateCloudApiWebhookJobId,
  effectiveDailyLimit,
  stableVariant,
  isInWindow
} = require('./providers/cloud-api');

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
  MetaCloudApiProvider,
  WatiProvider,
  TwilioProvider,
  ZernioProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature,

  // Zernio (Social Media API — publishing + social inbox + ads, 15 channels) (v1.21.0+)
  ZernioPostsManager,
  ZernioMediaManager,
  ZernioAccountsManager,
  ZernioConnectManager,
  ZernioMessagingManager,
  ZernioCommentsManager,
  ZernioReviewsManager,
  ZernioWhatsAppManager,
  ZernioAnalyticsManager,
  ZernioCrmManager,
  ZernioAdsManager,
  ZernioEngagementManager,
  ZernioWebhooksManager,
  ZernioApiError,
  ZERNIO_ERROR_CODES,
  isZernioRetryable,
  parseZernioWebhook,
  validateZernioSignature,
  generateZernioWebhookJobId,
  ZERNIO_EVENT_MAP,
  ZERNIO_WEBHOOK_EVENTS,
  ZERNIO_PLATFORM_TO_PROVIDER_TYPE,

  // Twilio (SMS / MMS / WhatsApp) (v1.18.0+)
  TwilioMessagingManager,
  TwilioMediaManager,
  TwilioAccountManager,
  TwilioApiError,
  TWILIO_ERROR_CODES,
  isTwilioRetryable,
  parseTwilioWebhook,
  validateTwilioSignature,
  computeTwilioSignature,
  generateTwilioWebhookJobId,
  TWILIO_STATUS_MAP,
  messagingResponse,
  emptyMessagingResponse,
  redirectResponse,
  toChannelAddress,
  parseChannelAddress,
  TwilioConnectManager,
  buildTwilioConnectAuthorizeUrl,
  parseTwilioConnectCallback,
  parseTwilioConnectDeauthorize,
  TWILIO_CONNECT_AUTHORIZE_BASE_URL,
  TwilioContentManager,

  // Wati (WhatsApp Business / BSP)
  WatiMessagingManager,
  WatiContactsManager,
  WatiConversationsManager,
  WatiTemplatesManager,
  WatiAccountManager,
  WatiChatbotsManager,
  parseWatiWebhook,
  validateWatiSignature,
  generateWatiWebhookJobId,
  WATI_EVENT_MAP,
  WATI_VALID_CHAT_STATUSES,

  // Cloud API (Meta WhatsApp official) (v1.10.0+)
  MetaCloudApiMessagingManager,
  MetaCloudApiTemplateManager,
  MetaCloudApiMediaManager,
  MetaCloudApiAccountManager,
  MetaApiError,
  META_ERROR_CODES,
  isCloudApiRetryable,
  parseCloudApiWebhook,
  validateCloudApiSignature,
  generateCloudApiWebhookJobId,
  effectiveDailyLimit,
  stableVariant,
  isInWindow,

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
