/**
 * Providers module - Provider factory and exports
 */

const { BaseProvider } = require('./base');
const { UnipileProvider } = require('./unipile/client');
const {
  parseUnipileWebhook,
  validateUnipileSignature,
  generateWebhookJobId
} = require('./unipile/webhooks');
const { UazapiProvider } = require('./uazapi/client');
const {
  parseUazapiWebhook,
  validateUazapiSignature
} = require('./uazapi/webhooks');
const { WebchatProvider } = require('./webchat/client');
const {
  parseWebchatWebhook,
  validateWebchatSignature
} = require('./webchat/webhooks');
const { MetaCloudApiProvider } = require('./cloud-api/client');
const {
  parseCloudApiWebhook,
  validateCloudApiSignature
} = require('./cloud-api/webhooks');
const { WatiProvider } = require('./wati/client');
const {
  parseWatiWebhook,
  validateWatiSignature
} = require('./wati/webhooks');
const { TwilioProvider } = require('./twilio/client');
const {
  parseTwilioWebhook,
  validateTwilioSignature
} = require('./twilio/webhooks');
const { ZernioProvider } = require('./zernio/client');
const {
  parseZernioWebhook,
  validateZernioSignature
} = require('./zernio/webhooks');

/**
 * Available providers
 */
const providers = {
  unipile: UnipileProvider,
  uazapi: UazapiProvider,
  webchat: WebchatProvider,
  'cloud-api': MetaCloudApiProvider,
  wati: WatiProvider,
  twilio: TwilioProvider,
  zernio: ZernioProvider
};

/**
 * Create a provider instance
 *
 * @param {string} providerName - Provider name (e.g., 'unipile', 'uazapi')
 * @param {Object} config - Provider configuration
 * @returns {BaseProvider}
 */
function createProvider(providerName, config) {
  const Provider = providers[providerName.toLowerCase()];

  if (!Provider) {
    throw new Error(`Unknown provider: ${providerName}. Available: ${Object.keys(providers).join(', ')}`);
  }

  return new Provider(config);
}

/**
 * Parse a webhook from any provider
 *
 * @param {string} providerName - Provider name
 * @param {Object} rawPayload - Raw webhook payload
 * @returns {NormalizedEvent}
 */
function parseWebhook(providerName, rawPayload) {
  switch (providerName.toLowerCase()) {
    case 'unipile':
      return parseUnipileWebhook(rawPayload);
    case 'uazapi':
      return parseUazapiWebhook(rawPayload);
    case 'webchat':
      return parseWebchatWebhook(rawPayload);
    case 'cloud-api':
      return parseCloudApiWebhook(rawPayload);
    case 'wati':
      return parseWatiWebhook(rawPayload);
    case 'twilio':
      return parseTwilioWebhook(rawPayload);
    case 'zernio':
      return parseZernioWebhook(rawPayload);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

/**
 * Validate a webhook signature
 *
 * @param {string} providerName - Provider name
 * @param {Object} payload - Webhook payload. For most providers this is the raw
 *   body; for `twilio` it must be `{ url, params }` (Twilio signs the request
 *   URL + sorted POST params), so pass the full request URL and the
 *   form-decoded body.
 * @param {string} signature - Signature header
 * @param {string} secret - Webhook secret (Twilio: the Auth Token)
 * @returns {boolean}
 */
function validateWebhookSignature(providerName, payload, signature, secret) {
  switch (providerName.toLowerCase()) {
    case 'unipile':
      return validateUnipileSignature(payload, signature, secret);
    case 'uazapi':
      return validateUazapiSignature(payload, signature, secret);
    case 'webchat':
      return validateWebchatSignature(payload, signature, secret);
    case 'cloud-api':
      return validateCloudApiSignature(payload, signature, secret);
    case 'wati':
      return validateWatiSignature(payload, signature, secret);
    case 'twilio':
      return validateTwilioSignature(
        payload && payload.url,
        payload && payload.params,
        signature,
        secret
      );
    case 'zernio':
      return validateZernioSignature(payload, signature, secret);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

module.exports = {
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
  providers
};
