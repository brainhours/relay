/**
 * SSERealtimeAdapter — zero-dependency default realtime for webchat.
 *
 * Server-Sent Events over HTTP. Uses only Node + Express built-ins. Suitable
 * for single-process deployments. Multi-pod deployments need a pub/sub layer
 * (Redis, NATS) or a hosted service (Ably, Pusher) — implement your own
 * adapter in that case.
 *
 * Publishing: publish() finds open connections for the channel and writes
 * the SSE payload directly to each response stream.
 *
 * Connection: the widget uses EventSource(url). The adapter mounts the SSE
 * endpoint at `${basePath}` via attachServerHandlers(); the URL returned by
 * getWidgetConnectionInfo includes the visitor token + conversationId for
 * ownership verification.
 *
 * Limitations:
 *   - Single-process only (in-memory connection map)
 *   - Hold-open connections count against your server's open-FD limit
 *   - Some proxies / CDNs buffer SSE; we send `X-Accel-Buffering: no` and
 *     periodic comments to keep the stream open.
 */

const { WebchatRealtimeAdapter } = require('./realtime');

class SSERealtimeAdapter extends WebchatRealtimeAdapter {
  /**
   * @param {Object} [options]
   * @param {string} [options.basePath='/_relay/sse']  - URL path for the SSE endpoint
   * @param {number} [options.heartbeatMs=25000]       - keep-alive comment interval
   */
  constructor({ basePath = '/_relay/sse', heartbeatMs = 25000 } = {}) {
    super();
    this.basePath = basePath;
    this.heartbeatMs = heartbeatMs;
    this._channels = new Map();   // channel -> Set<res>
  }

  /**
   * Write an SSE-formatted event to all open connections on the channel.
   */
  async publish(channel, event, data) {
    const subs = this._channels.get(channel);
    if (!subs || subs.size === 0) return;

    const payload =
      `event: ${event}\n` +
      `data: ${JSON.stringify(data)}\n` +
      `\n`;

    for (const res of subs) {
      try {
        res.write(payload);
      } catch {
        // Broken pipe — connection will be cleaned up by 'close' handler
      }
    }
  }

  async getWidgetConnectionInfo({ conversationId, visitorToken, mountPath = '' }) {
    const params = new URLSearchParams({
      conversationId: String(conversationId),
      token: String(visitorToken)
    });
    return {
      transport: 'sse',
      url: `${mountPath}${this.basePath}?${params.toString()}`
    };
  }

  /**
   * Mount the SSE endpoint on the given router.
   * `ctx.storage` is used to verify visitor ownership before holding the
   * connection open.
   */
  attachServerHandlers(router, ctx = {}) {
    const { storage } = ctx;
    if (!storage) {
      throw new Error('SSERealtimeAdapter.attachServerHandlers: ctx.storage is required');
    }

    router.get(this.basePath, async (req, res) => {
      const conversationId = String(req.query.conversationId || '');
      const visitorToken = String(req.query.token || '');

      if (!conversationId || !visitorToken) {
        res.status(400).end();
        return;
      }

      // Ownership check via storage adapter
      let visitor;
      try {
        visitor = await storage.findVisitor(visitorToken);
      } catch {
        res.status(500).end();
        return;
      }
      if (!visitor) {
        res.status(403).end();
        return;
      }

      let conv;
      try {
        conv = await storage.getConversationForVisitor(conversationId, visitor.id);
      } catch {
        res.status(500).end();
        return;
      }
      if (!conv) {
        res.status(403).end();
        return;
      }

      // Open the SSE stream
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      // Some Express versions require flushHeaders to trigger early send
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      res.write('retry: 5000\n\n');

      const channel = `conversation:${conversationId}`;
      let subs = this._channels.get(channel);
      if (!subs) {
        subs = new Set();
        this._channels.set(channel, subs);
      }
      subs.add(res);

      const heartbeat = setInterval(() => {
        try { res.write(`: ping ${Date.now()}\n\n`); } catch { /* ignored */ }
      }, this.heartbeatMs);

      const cleanup = () => {
        clearInterval(heartbeat);
        const set = this._channels.get(channel);
        if (set) {
          set.delete(res);
          if (set.size === 0) this._channels.delete(channel);
        }
      };

      req.on('close', cleanup);
      req.on('aborted', cleanup);
      res.on('close', cleanup);
    });
  }

  /**
   * Returns the number of currently open connections per channel.
   * Useful for ops dashboards / tests.
   */
  stats() {
    const out = {};
    for (const [channel, subs] of this._channels.entries()) {
      out[channel] = subs.size;
    }
    return out;
  }
}

module.exports = { SSERealtimeAdapter };
