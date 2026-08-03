/**
 * Meta WhatsApp Cloud API provider — official Meta Graph API integration.
 *
 * Single-endpoint, multi-tenant via per-call credentials. Mirrors the shape
 * of the Uazapi provider in this package.
 *
 * @example
 *   const {
 *     MetaCloudApiProvider, parseCloudApiWebhook, validateCloudApiSignature,
 *     MessagingEventEmitter, EventTypes
 *   } = require('@brainhours/relay-core');
 *
 *   const meta = new MetaCloudApiProvider({
 *     apiVersion: 'v22.0',
 *     appSecret: process.env.META_APP_SECRET
 *   });
 *
 *   const emitter = new MessagingEventEmitter();
 *   emitter.on(EventTypes.MESSAGE_RECEIVED, (e) => {
 *     if (e.providerType !== 'WHATSAPP') return;
 *     console.log(e.senderName, ':', e.content);
 *   });
 *
 *   app.use('/webhooks/meta', express.json({
 *     verify: (req, _res, buf) => { req.rawBody = buf; }
 *   }));
 *   app.post('/webhooks/meta', (req, res) => {
 *     if (!validateCloudApiSignature(req.rawBody, req.headers['x-hub-signature-256'], appSecret)) {
 *       return res.sendStatus(401);
 *     }
 *     for (const ev of parseCloudApiWebhook(req.body)) emitter.emit(ev);
 *     res.sendStatus(200);
 *   });
 */

const { MetaCloudApiProvider } = require('./client');
const { MetaCloudApiMessagingManager } = require('./messaging');
const { MetaCloudApiTemplateManager } = require('./templates');
const { MetaCloudApiMediaManager } = require('./media');
const { MetaCloudApiAccountManager } = require('./account');
const { MetaApiError, META_ERROR_CODES, isRetryable } = require('./errors');
const {
  parseCloudApiWebhook,
  validateCloudApiSignature,
  generateWebhookJobId
} = require('./webhooks');
const { effectiveDailyLimit } = require('./helpers/rate-limit');
const { stableVariant } = require('./helpers/ab-split');
const { isInWindow, DEFAULT_WINDOW_MS } = require('./helpers/window');

module.exports = {
  // Provider
  MetaCloudApiProvider,

  // Managers (also reachable via provider instance)
  MetaCloudApiMessagingManager,
  MetaCloudApiTemplateManager,
  MetaCloudApiMediaManager,
  MetaCloudApiAccountManager,

  // Errors
  MetaApiError,
  META_ERROR_CODES,
  isRetryable,

  // Webhook utilities
  parseCloudApiWebhook,
  validateCloudApiSignature,
  generateWebhookJobId,

  // Helpers (opt-in utilities)
  effectiveDailyLimit,
  stableVariant,
  isInWindow,
  DEFAULT_WINDOW_MS
};
