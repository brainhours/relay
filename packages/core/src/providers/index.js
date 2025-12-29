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

/**
 * Available providers
 */
const providers = {
  unipile: UnipileProvider
  // twilio: TwilioProvider, // Coming soon
  // uazapi: UazapiProvider  // Coming soon
};

/**
 * Create a provider instance
 *
 * @param {string} providerName - Provider name (e.g., 'unipile')
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
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

module.exports = {
  BaseProvider,
  UnipileProvider,
  createProvider,
  parseWebhook,
  validateWebhookSignature,
  providers
};
