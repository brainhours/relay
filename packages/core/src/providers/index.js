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

/**
 * Available providers
 */
const providers = {
  unipile: UnipileProvider,
  uazapi: UazapiProvider,
  webchat: WebchatProvider
  // twilio: TwilioProvider, // Coming soon
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
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

/**
 * Validate a webhook signature
 *
 * @param {string} providerName - Provider name
 * @param {Object} payload - Webhook payload
 * @param {string} signature - Signature header
 * @param {string} secret - Webhook secret
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
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

module.exports = {
  BaseProvider,
  UnipileProvider,
  UazapiProvider,
  WebchatProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature,
  providers
};
