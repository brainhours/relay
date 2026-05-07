/**
 * WebchatRealtimeAdapter — abstract contract for realtime fan-out.
 *
 * The adapter has 3 jobs:
 *   1. publish events to channels (server → server side fan-out)
 *   2. tell the widget HOW to receive events for its conversation (transport descriptor)
 *   3. optionally host its own server endpoints (true for SSE/WS, false for Ably/Pusher)
 *
 * Channel naming convention (stable across adapters):
 *   conversation:{conversationId}     -- visitor + agents subscribed
 *   account:{accountId}               -- agents/dashboard only
 *
 * Standard event names emitted on the conversation channel:
 *   'new_message', 'conversation_updated', 'message_read', 'typing'
 *
 * Standard event names emitted on the account channel:
 *   'new_message', 'new_conversation', 'conversation_updated'
 *
 * Relay ships exactly one default implementation: SSERealtimeAdapter (zero-dep).
 * Other transports (Ably, Pusher, Redis pub/sub, custom WS) are written by the
 * consuming app as ~50-line classes extending this base. See
 * examples/webchat-ably/ for a reference Ably implementation.
 */

class WebchatRealtimeAdapter {
  /**
   * Publish an event to a channel. Called by the http handler after persisting
   * a visitor message, and by WebchatMessagingManager after sending an
   * agent/AI message.
   *
   * Implementations should be best-effort: a missing/disconnected backend
   * should not throw — log and return.
   *
   * @param {string} channel   e.g. 'conversation:abc123'
   * @param {string} event     e.g. 'new_message'
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async publish(channel, event, data) {
    throw new Error('WebchatRealtimeAdapter.publish not implemented');
  }

  /**
   * Tell the widget where/how to subscribe for this conversation. The result
   * is returned to the browser inside the /:widgetKey/session response so the
   * widget can pick the right transport.
   *
   * For HTTP-based transports (SSE/WS), the URL must be relative to the
   * widget's `data-api-url` — i.e. it should include the Express mount path
   * the handler is registered under. The factory passes `mountPath` to allow
   * adapters to construct the right URL without hardcoding it.
   *
   * @param {Object} ctx
   * @param {string} ctx.conversationId
   * @param {string} ctx.visitorToken
   * @param {string} ctx.accountId
   * @param {string} [ctx.mountPath]      - e.g. '/api/public/webchat'; injected by factory
   * @returns {Promise<Object>} one of:
   *   { transport: 'sse',       url: string }
   *   { transport: 'websocket', url: string, protocol?: string }
   *   { transport: 'ably',      tokenRequest: object }
   *   { transport: 'pusher',    auth: object }
   *   { transport: 'custom',    name: string, config: any }
   */
  async getWidgetConnectionInfo(/* ctx */) {
    throw new Error('WebchatRealtimeAdapter.getWidgetConnectionInfo not implemented');
  }

  /**
   * Optional. If the realtime layer requires the app's HTTP server to host
   * its own endpoints (e.g. an SSE or WebSocket route), the adapter
   * registers them here. Called once at handler-mount time.
   *
   * @param {import('express').Router} router
   * @param {Object} ctx       { storage }   — injected by createWebchatHandler
   */
  attachServerHandlers(/* router, ctx */) {
    /* default: no-op (services like Ably need nothing from us) */
  }

  /** Reports whether the adapter is currently usable. */
  isAvailable() { return true; }
}

module.exports = { WebchatRealtimeAdapter };
