/**
 * Transport registry — built-in transports + plugin slot.
 *
 * Each transport is a factory:
 *   (info, callbacks, ctx) => { connect(), close() }
 *
 *   info       The realtime descriptor returned by the backend's
 *              /:widgetKey/session response, e.g. { transport: 'sse', url: '...' }.
 *   callbacks  { onOpen?, onMessage(message), onError?(err), onClose?() }
 *              The widget calls onMessage with the incoming message object;
 *              the message object's `sender_type`, `content`, `id`, `sent_at`
 *              fields drive the chat UI.
 *   ctx        { apiBase, conversationId, visitorToken, widgetKey }
 *              Useful constants the transport may need.
 *
 * Apps can register custom transports BEFORE the widget connects:
 *
 *   <script src="ably.min.js"></script>
 *   <script src="/widget/dist/widget.js" data-widget-key="..." data-api-url="..."></script>
 *   <script>
 *     RelayWebchat.registerTransport('ably', (info, cb, ctx) => {
 *       const ably = new Ably.Realtime({ authCallback: (_, done) => done(null, info.tokenRequest) });
 *       const ch = ably.channels.get('conversation:' + ctx.conversationId);
 *       ch.subscribe('new_message', m => cb.onMessage(m.data?.message || m.data));
 *       return { connect() {}, close() { ably.close(); } };
 *     });
 *   </script>
 */

import { sseTransport } from './sse.js';
import { websocketTransport } from './websocket.js';

const transports = Object.create(null);

export function registerTransport(name, factory) {
  if (typeof name !== 'string' || typeof factory !== 'function') {
    throw new Error('registerTransport(name, factory): invalid arguments');
  }
  transports[name] = factory;
}

export function getTransport(name) {
  return transports[name] || null;
}

// Built-ins
transports.sse = sseTransport;
transports.websocket = websocketTransport;

export { transports };
