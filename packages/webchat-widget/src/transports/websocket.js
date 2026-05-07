/**
 * WebSocket transport — uses the browser-native WebSocket.
 *
 * Activated when the /session response returns:
 *   { transport: 'websocket', url: '/api/public/webchat/_relay/ws?...', protocol?: '...' }
 *
 * Server is expected to send JSON messages of the form:
 *   { event: 'new_message', data: {...} }
 *
 * The URL is converted to ws:// or wss:// based on the page protocol when
 * relative; absolute URLs are used as-is.
 */

export function websocketTransport(info, callbacks, ctx) {
  let url = info.url;
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      url = url.replace(/^http/, 'ws');
    } else {
      // Relative path — combine with apiBase
      const base = ctx.apiBase.replace(/^http/, 'ws');
      url = `${base}${url.startsWith('/') ? url : '/' + url}`;
    }
  }

  let ws = null;
  let closed = false;

  return {
    connect() {
      try {
        ws = info.protocol ? new WebSocket(url, info.protocol) : new WebSocket(url);
      } catch (err) {
        callbacks.onError?.(err);
        return;
      }

      ws.onopen = () => callbacks.onOpen?.();

      ws.onmessage = (e) => {
        if (closed) return;
        let frame;
        try { frame = JSON.parse(e.data); } catch { return; }
        if (frame && frame.event === 'new_message') {
          const message = frame.data?.message || frame.data || frame;
          callbacks.onMessage?.(message);
        }
      };

      ws.onerror = (e) => {
        if (closed) return;
        callbacks.onError?.(e);
      };

      ws.onclose = (e) => callbacks.onClose?.(e);
    },

    close() {
      closed = true;
      if (ws) {
        try { ws.close(); } catch { /* noop */ }
        ws = null;
      }
    }
  };
}
