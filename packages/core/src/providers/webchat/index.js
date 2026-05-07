/**
 * Webchat Provider — first-party embeddable chat channel for the Relay.
 *
 * Components shipped from this barrel:
 *   - WebchatProvider                 -- the messaging-side SDK class
 *   - createWebchatHandler            -- Express factory mounting public routes
 *   - WebchatStorageAdapter           -- abstract storage contract (extend this)
 *   - WebchatRealtimeAdapter          -- abstract realtime contract (extend this)
 *   - InMemoryWebchatStorage          -- zero-dep default storage (POCs/tests)
 *   - SSERealtimeAdapter              -- zero-dep default realtime (single-process)
 *   - parseWebchatWebhook             -- payload -> NormalizedEvent
 *   - generateVisitorToken            -- 32-byte hex token generator
 *
 * NOT shipped here (deliberately): adapters for paid third-party services
 * such as Ably or Pusher. Those are written by the consuming app as small
 * classes extending WebchatRealtimeAdapter. See examples/webchat-ably/ for
 * a reference implementation.
 *
 * @example  Quick start (zero-dep):
 *   const express = require('express');
 *   const {
 *     createWebchatHandler, InMemoryWebchatStorage, SSERealtimeAdapter,
 *     MessagingEventEmitter, EventTypes
 *   } = require('@guilhermegoulart1/relay-core');
 *
 *   const storage = new InMemoryWebchatStorage();
 *   storage.seedChannel({ widgetKey: 'demo', accountId: 'acc-1' });
 *
 *   const realtime = new SSERealtimeAdapter();
 *   const emitter = new MessagingEventEmitter();
 *   emitter.on(EventTypes.MESSAGE_RECEIVED, e => console.log(e.content));
 *
 *   const app = express();
 *   app.use('/api/public/webchat',
 *     createWebchatHandler({ storage, realtime, emitter }));
 *   app.listen(3000);
 */

const { WebchatProvider } = require('./client');
const { WebchatMessagingManager } = require('./messaging');
const { createWebchatHandler } = require('./http-handler');
const {
  parseWebchatWebhook,
  validateWebchatSignature,
  generateWebhookJobId
} = require('./webhooks');
const {
  generateVisitorToken,
  isValidVisitorTokenFormat
} = require('./tokens');
const { WebchatStorageAdapter } = require('./adapters/storage');
const { WebchatRealtimeAdapter } = require('./adapters/realtime');
const { SSERealtimeAdapter } = require('./adapters/sse');
const { InMemoryWebchatStorage } = require('./adapters/memory-storage');

module.exports = {
  // Provider
  WebchatProvider,
  WebchatMessagingManager,

  // HTTP factory
  createWebchatHandler,

  // Adapter contracts
  WebchatStorageAdapter,
  WebchatRealtimeAdapter,

  // Default zero-dep adapters
  SSERealtimeAdapter,
  InMemoryWebchatStorage,

  // Webhook utilities
  parseWebchatWebhook,
  validateWebchatSignature,
  generateWebhookJobId,

  // Tokens
  generateVisitorToken,
  isValidVisitorTokenFormat
};
