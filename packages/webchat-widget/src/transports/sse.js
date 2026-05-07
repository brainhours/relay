/**
 * SSE transport — uses the browser-native EventSource.
 *
 * Activated when the /session response returns:
 *   { transport: 'sse', url: '/api/public/webchat/_relay/sse?...' }
 *
 * The URL is relative to data-api-url; this transport prepends apiBase
 * automatically.
 */

export function sseTransport(info, callbacks, ctx) {
  const fullUrl = info.url.startsWith('http')
    ? info.url
    : `${ctx.apiBase}${info.url}`;

  let es = null;
  let closed = false;

  return {
    connect() {
      try {
        es = new EventSource(fullUrl);
      } catch (err) {
        callbacks.onError?.(err);
        return;
      }

      es.addEventListener('new_message', (e) => {
        if (closed) return;
        let payload;
        try { payload = JSON.parse(e.data); } catch { return; }
        const message = payload.message || payload;
        callbacks.onMessage?.(message);
      });

      es.addEventListener('error', (e) => {
        if (closed) return;
        callbacks.onError?.(e);
      });

      es.addEventListener('open', () => callbacks.onOpen?.());
    },

    close() {
      closed = true;
      if (es) {
        try { es.close(); } catch { /* noop */ }
        es = null;
      }
    }
  };
}
