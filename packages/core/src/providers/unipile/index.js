/**
 * Unipile Provider - Multi-channel messaging integration
 *
 * @example
 * const { UnipileProvider } = require('@relay/core/providers/unipile');
 *
 * const unipile = new UnipileProvider({
 *   dsn: process.env.UNIPILE_DSN,
 *   accessToken: process.env.UNIPILE_ACCESS_TOKEN
 * });
 *
 * // Send a message
 * await unipile.messaging.send({
 *   account_id: 'acc_123',
 *   user_id: 'user_456',
 *   text: 'Hello!'
 * });
 */

const { UnipileProvider } = require('./client');
const {
  parseUnipileWebhook,
  parseUnipileWebhookRaw,
  validateUnipileSignature,
  generateWebhookJobId,
  UNIPILE_EVENT_MAP
} = require('./webhooks');

module.exports = {
  UnipileProvider,
  parseUnipileWebhook,
  parseUnipileWebhookRaw,
  validateUnipileSignature,
  generateWebhookJobId,
  UNIPILE_EVENT_MAP
};
