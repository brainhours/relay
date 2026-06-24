/**
 * Twilio provider — official Twilio Programmable Messaging integration
 * (SMS, MMS, WhatsApp).
 *
 * Single-endpoint, multi-tenant via per-call credentials (Twilio subaccounts).
 * Mirrors the shape of the Meta Cloud API provider in this package.
 *
 * @example
 *   const {
 *     TwilioProvider, parseTwilioWebhook, validateTwilioSignature,
 *     messagingResponse, MessagingEventEmitter, EventTypes
 *   } = require('@guilhermegoulart1/relay-core');
 *
 *   const twilio = new TwilioProvider({
 *     accountSid: process.env.TWILIO_ACCOUNT_SID,
 *     authToken:  process.env.TWILIO_AUTH_TOKEN
 *   });
 *
 *   const emitter = new MessagingEventEmitter();
 *   emitter.on(EventTypes.MESSAGE_RECEIVED, (e) => {
 *     if (e.provider !== 'twilio') return;
 *     console.log(e.senderName || e.senderId, ':', e.content);
 *   });
 *
 *   app.post('/webhooks/twilio',
 *     express.urlencoded({ extended: false }),
 *     (req, res) => {
 *       const url = `https://${req.headers.host}${req.originalUrl}`;
 *       if (!validateTwilioSignature(url, req.body, req.headers['x-twilio-signature'], process.env.TWILIO_AUTH_TOKEN)) {
 *         return res.sendStatus(403);
 *       }
 *       emitter.emit(parseTwilioWebhook(req.body));
 *       res.type('text/xml').send(messagingResponse('Got it, thanks!'));
 *     });
 */

const {
  TwilioProvider,
  toChannelAddress,
  parseChannelAddress,
  toFormBody,
  API_VERSION,
  DEFAULT_BASE_URL
} = require('./client');
const { TwilioMessagingManager } = require('./messaging');
const { TwilioMediaManager } = require('./media');
const { TwilioAccountManager, MESSAGING_BASE_URL } = require('./account');
const { TwilioApiError, TWILIO_ERROR_CODES, isRetryable } = require('./errors');
const {
  parseTwilioWebhook,
  validateTwilioSignature,
  computeTwilioSignature,
  generateWebhookJobId,
  TWILIO_STATUS_MAP
} = require('./webhooks');
const {
  messagingResponse,
  emptyMessagingResponse,
  redirectResponse
} = require('./twiml');

module.exports = {
  // Provider
  TwilioProvider,

  // Managers (also reachable via provider instance)
  TwilioMessagingManager,
  TwilioMediaManager,
  TwilioAccountManager,

  // Errors
  TwilioApiError,
  TWILIO_ERROR_CODES,
  isRetryable,

  // Webhook utilities
  parseTwilioWebhook,
  validateTwilioSignature,
  computeTwilioSignature,
  generateWebhookJobId,
  TWILIO_STATUS_MAP,

  // TwiML builders
  messagingResponse,
  emptyMessagingResponse,
  redirectResponse,

  // Address helpers
  toChannelAddress,
  parseChannelAddress,
  toFormBody,

  // Constants
  API_VERSION,
  DEFAULT_BASE_URL,
  MESSAGING_BASE_URL
};
