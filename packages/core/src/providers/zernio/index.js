/**
 * Zernio provider — unified Social Media API (publishing + social inbox + ads)
 * across 15 channels: Twitter/X, Instagram, Facebook, LinkedIn, TikTok,
 * YouTube, Pinterest, Reddit, Bluesky, Threads, Google Business, Telegram,
 * Snapchat, WhatsApp, Discord.
 *
 * @example
 *   const {
 *     ZernioProvider, parseZernioWebhook, validateZernioSignature,
 *     MessagingEventEmitter, EventTypes
 *   } = require('@brainhours/relay-core');
 *
 *   const zernio = new ZernioProvider({
 *     apiKey: process.env.ZERNIO_API_KEY,
 *     webhookSecret: process.env.ZERNIO_WEBHOOK_SECRET
 *   });
 *
 *   // Publish to multiple channels at once
 *   await zernio.posts.create({
 *     content: 'Hello world',
 *     publishNow: true,
 *     platforms: [{ platform: 'linkedin', accountId }]
 *   });
 *
 *   // Inbox intake
 *   const emitter = new MessagingEventEmitter();
 *   app.post('/webhooks/zernio', (req, res) => {
 *     const event = parseZernioWebhook(req.body);
 *     if (event) emitter.emit(event);
 *     res.sendStatus(200);
 *   });
 */

const { ZernioProvider, DEFAULT_BASE_URL, API_VERSION } = require('./client');
const { ZernioPostsManager } = require('./posts');
const { ZernioMediaManager } = require('./media');
const { ZernioAccountsManager } = require('./accounts');
const { ZernioConnectManager } = require('./connect');
const { ZernioMessagingManager } = require('./messaging');
const { ZernioCommentsManager } = require('./comments');
const { ZernioReviewsManager } = require('./reviews');
const { ZernioWhatsAppManager } = require('./whatsapp');
const { ZernioAnalyticsManager } = require('./analytics');
const { ZernioCrmManager } = require('./crm');
const { ZernioAdsManager } = require('./ads');
const { ZernioEngagementManager } = require('./engagement');
const { ZernioWebhooksManager, ZERNIO_WEBHOOK_EVENTS } = require('./webhooks-manager');
const { ZernioApiError, ZERNIO_ERROR_CODES, isRetryable } = require('./errors');
const {
  parseZernioWebhook,
  validateZernioSignature,
  generateWebhookJobId,
  ZERNIO_EVENT_MAP,
  PLATFORM_TO_PROVIDER_TYPE
} = require('./webhooks');

module.exports = {
  // Provider
  ZernioProvider,

  // Managers (also reachable via provider instance)
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

  // Errors
  ZernioApiError,
  ZERNIO_ERROR_CODES,
  isRetryable,

  // Webhook utilities
  parseZernioWebhook,
  validateZernioSignature,
  generateWebhookJobId,
  ZERNIO_EVENT_MAP,
  ZERNIO_WEBHOOK_EVENTS,
  PLATFORM_TO_PROVIDER_TYPE,

  // Constants
  DEFAULT_BASE_URL,
  API_VERSION
};
