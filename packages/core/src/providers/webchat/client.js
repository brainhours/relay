/**
 * WebchatProvider — Relay's first-party webchat channel.
 *
 * Unlike Unipile/Uazapi, webchat is not wrapping an external API: the Relay
 * (via the consuming app's Express server) IS the messaging server. The
 * provider holds the storage and realtime adapters that the app injects, and
 * exposes a messaging manager + a parser. The HTTP routes are mounted by
 * createWebchatHandler() (see ./http-handler.js).
 *
 * Defaults:
 *   - storage:  required, no default
 *   - realtime: required, no default
 *   - emitter:  optional, but typical apps pass MessagingEventEmitter so
 *               webchat events are dispatched alongside Unipile/Uazapi events
 *
 * @example
 *   const { WebchatProvider, InMemoryWebchatStorage, SSERealtimeAdapter,
 *           MessagingEventEmitter } = require('@guilhermegoulart1/relay-core');
 *
 *   const webchat = new WebchatProvider({
 *     storage: new InMemoryWebchatStorage(),
 *     realtime: new SSERealtimeAdapter(),
 *     emitter: new MessagingEventEmitter()
 *   });
 */

const { BaseProvider } = require('../base');
const { WebchatMessagingManager } = require('./messaging');
const {
  generateVisitorToken: defaultTokenGen,
  isValidVisitorTokenFormat
} = require('./tokens');

class WebchatProvider extends BaseProvider {
  /**
   * @param {Object} config
   * @param {import('./adapters/storage').WebchatStorageAdapter} config.storage   - REQUIRED
   * @param {import('./adapters/realtime').WebchatRealtimeAdapter} config.realtime - REQUIRED
   * @param {Object} [config.emitter]                  - MessagingEventEmitter for normalized events
   * @param {Function} [config.generateVisitorToken]   - override default token generator
   */
  constructor(config = {}) {
    super(config);
    this.name = 'webchat';
    this.initError = null;

    if (!config.storage) {
      this.initError = 'webchat: storage adapter is required';
    } else if (!config.realtime) {
      this.initError = 'webchat: realtime adapter is required';
    }

    this.storage = config.storage;
    this.realtime = config.realtime;
    this.emitter = config.emitter || null;
    this.generateVisitorToken = config.generateVisitorToken || defaultTokenGen;
    this.isValidVisitorTokenFormat = isValidVisitorTokenFormat;

    this.messaging = new WebchatMessagingManager(this);
  }

  /** @returns {boolean} */
  isInitialized() {
    return !this.initError;
  }

  /** @returns {string|null} */
  getError() {
    return this.initError;
  }
}

module.exports = { WebchatProvider };
