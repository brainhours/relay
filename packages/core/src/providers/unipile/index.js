/**
 * Unipile Provider - Multi-channel messaging integration
 *
 * @example
 * const { UnipileProvider } = require('@guilhermegoulart1/relay-core');
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
 *
 * // Search posts (v1.3.0+)
 * await unipile.posts.search({
 *   account_id: 'acc_123',
 *   keywords: 'technology'
 * });
 *
 * // Get company profile (v1.3.0+)
 * await unipile.company.getOne({
 *   account_id: 'acc_123',
 *   identifier: 'microsoft'
 * });
 */

const { UnipileProvider } = require('./client');
const { UnipileWebhookManager } = require('./webhooks-manager');
const { UnipilePostsManager } = require('./posts');
const { UnipileReactionsManager, REACTION_TYPES } = require('./reactions');
const { UnipileCommentsManager } = require('./comments');
const { UnipileCompanyManager } = require('./company');
const { UnipileJobsManager } = require('./jobs');
const {
  parseUnipileWebhook,
  parseUnipileWebhookRaw,
  validateUnipileSignature,
  generateWebhookJobId,
  UNIPILE_EVENT_MAP
} = require('./webhooks');

module.exports = {
  // Main provider
  UnipileProvider,

  // Managers (also accessible via provider instance)
  UnipileWebhookManager,
  UnipilePostsManager,
  UnipileReactionsManager,
  UnipileCommentsManager,
  UnipileCompanyManager,
  UnipileJobsManager,

  // Webhook utilities
  parseUnipileWebhook,
  parseUnipileWebhookRaw,
  validateUnipileSignature,
  generateWebhookJobId,
  UNIPILE_EVENT_MAP,

  // Constants
  REACTION_TYPES
};
