/**
 * Uazapi Provider - WhatsApp messaging via Uazapi (uazapiGO 2.1.0)
 *
 * Multi-server (multi-subscription) by design — declare one or more Uazapi
 * subscriptions in the pool with optional capacity, weight and enabled flags;
 * the provider routes calls to the right server using a pluggable strategy.
 *
 * @example  Single server
 * const { UazapiProvider } = require('@brainhours/relay-core');
 *
 * const uazapi = new UazapiProvider({
 *   baseUrl: process.env.UAZ_BASE_URL,        // e.g. 'https://free.uazapi.com'
 *   adminToken: process.env.UAZ_ADMIN_TOKEN
 * });
 *
 * // Provision a new WhatsApp instance and connect (QR)
 * const created = await uazapi.instance.create({ name: 'tenant-acme' });
 * const conn = await uazapi.instance.connect({
 *   token: created.token,
 *   serverId: created.serverId
 * });
 * console.log(conn.instance.qrcode);  // base64 PNG
 *
 * @example  Multi-server with heterogeneous capacities
 * const uazapi = new UazapiProvider({
 *   servers: [
 *     { id: 'plano-pequeno', baseUrl: 'https://srv1.uazapi.com', adminToken: '...', capacity: 2 },
 *     { id: 'plano-medio',   baseUrl: 'https://srv2.uazapi.com', adminToken: '...', capacity: 4 },
 *     { id: 'plano-grande',  baseUrl: 'https://srv3.uazapi.com', adminToken: '...', capacity: 10 }
 *   ],
 *   selectionStrategy: 'weighted-round-robin'
 * });
 */

const { UazapiProvider } = require('./client');
const { UazapiServerPool } = require('./server-pool');
const { UazapiInstanceManager } = require('./instance');
const { UazapiMessagingManager } = require('./messaging');
const { UazapiChatsManager } = require('./chats');
const { UazapiContactsManager } = require('./contacts');
const { UazapiMessagesManager } = require('./messages');
const { UazapiGroupsManager } = require('./groups');
const { UazapiProfileManager } = require('./profile');
const {
  UazapiWebhookManager,
  VALID_EVENTS,
  VALID_EXCLUDES
} = require('./webhooks-manager');
const {
  parseUazapiWebhook,
  validateUazapiSignature,
  generateWebhookJobId,
  UAZAPI_EVENT_MAP
} = require('./webhooks');

module.exports = {
  // Main provider
  UazapiProvider,

  // Server pool (also accessible via provider.pool)
  UazapiServerPool,

  // Managers (also accessible via provider instance)
  UazapiInstanceManager,
  UazapiMessagingManager,
  UazapiChatsManager,
  UazapiContactsManager,
  UazapiMessagesManager,
  UazapiGroupsManager,
  UazapiProfileManager,
  UazapiWebhookManager,

  // Webhook utilities
  parseUazapiWebhook,
  validateUazapiSignature,
  generateWebhookJobId,
  UAZAPI_EVENT_MAP,

  // Constants
  VALID_EVENTS,
  VALID_EXCLUDES
};
