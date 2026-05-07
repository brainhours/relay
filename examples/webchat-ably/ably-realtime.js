/**
 * AblyWebchatRealtime — REFERENCE IMPLEMENTATION (example code, NOT shipped by Relay).
 *
 * Demonstrates how to write a custom WebchatRealtimeAdapter against a third-party
 * realtime service. Apps that use Ably (or want to use it) can copy this file
 * into their own codebase. The Relay deliberately does not ship this in core
 * because that would imply Ably is the recommended/default — it isn't, it's
 * one of many possible choices.
 *
 * Side note: the same shape works for Pusher, PubNub, Centrifugo, custom
 * WebSocket servers, etc. Just adapt the publish / token-request calls.
 */

const { WebchatRealtimeAdapter } = require('@guilhermegoulart1/relay-core');

class AblyWebchatRealtime extends WebchatRealtimeAdapter {
  /**
   * @param {Object} opts
   * @param {import('ably').Realtime} opts.ablyClient - already-initialized Ably client
   */
  constructor({ ablyClient }) {
    super();
    if (!ablyClient) throw new Error('AblyWebchatRealtime requires an ablyClient');
    this.ably = ablyClient;
  }

  isAvailable() {
    return !!this.ably && this.ably.connection.state === 'connected';
  }

  async publish(channel, event, data) {
    if (!this.isAvailable()) return;
    try {
      await this.ably.channels.get(channel).publish(event, data);
    } catch (err) {
      console.warn('[ably] publish failed', err.message);
    }
  }

  async getWidgetConnectionInfo({ conversationId, visitorToken }) {
    const tokenRequest = await new Promise((resolve, reject) => {
      this.ably.auth.createTokenRequest(
        {
          clientId: `visitor:${visitorToken}`,
          capability: { [`conversation:${conversationId}`]: ['subscribe'] },
          ttl: 60 * 60 * 1000
        },
        (err, tr) => (err ? reject(err) : resolve(tr))
      );
    });
    return { transport: 'ably', tokenRequest };
  }

  // Ably hosts the channels itself — no Express handlers to attach.
}

module.exports = { AblyWebchatRealtime };
