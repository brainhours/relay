/**
 * Reference: webchat with Ably as the realtime layer.
 *
 * NOT shipped by Relay. This is an example showing how an app that already
 * uses Ably can plug it into the WebchatRealtimeAdapter contract.
 *
 * Requires ABLY_API_KEY in env.
 */

const path = require('path');
const express = require('express');
const Ably = require('ably');
const {
  createWebchatHandler,
  InMemoryWebchatStorage,
  WebchatProvider,
  MessagingEventEmitter,
  EventTypes
} = require('@guilhermegoulart1/relay-core');
const { AblyWebchatRealtime } = require('./ably-realtime');

const PORT = process.env.PORT || 3000;
const WIDGET_KEY = process.env.WIDGET_KEY || 'demo123abcdef0123456789abcdef0123';

if (!process.env.ABLY_API_KEY) {
  console.error('Missing ABLY_API_KEY env var');
  process.exit(1);
}

// 1. Storage + Ably realtime + emitter
const storage = new InMemoryWebchatStorage();
storage.seedChannel({
  widgetKey: WIDGET_KEY,
  accountId: 'acc-demo',
  agent_name: 'Ably Demo'
});

const ablyClient = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
const realtime = new AblyWebchatRealtime({ ablyClient });

const emitter = new MessagingEventEmitter();
const provider = new WebchatProvider({ storage, realtime, emitter });

emitter.on(EventTypes.MESSAGE_RECEIVED, (event) => {
  if (event.providerType !== 'WEBCHAT') return;
  console.log(`[visitor] ${event.content}`);
  setTimeout(() => {
    provider.messaging.sendMessage({
      conversationId: event.chatId,
      accountId: event.accountId,
      content: `🔵 Echo via Ably: ${event.content}`,
      senderType: 'ai'
    });
  }, 600);
});

// 2. Express
const app = express();
app.use('/api/public/webchat', createWebchatHandler({ storage, realtime, emitter }));

const widgetDist = path.join(
  path.dirname(require.resolve('@guilhermegoulart1/relay-webchat-widget/package.json')),
  'dist'
);
app.use('/widget/dist', express.static(widgetDist));

// Demo page — note the additional <script> registering the Ably transport plugin
app.get('/', (_req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Relay Webchat — Ably reference</title>
  <style>body{font-family:system-ui;max-width:640px;margin:60px auto;padding:0 20px;color:#1f2937}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}</style>
</head>
<body>
  <h1>Relay Webchat — Ably realtime reference</h1>
  <p>Backend uses <code>AblyWebchatRealtime</code> (this directory's
     <code>ably-realtime.js</code>); the widget receives messages through Ably
     instead of SSE because the backend's <code>/session</code> response
     declares <code>transport: 'ably'</code>.</p>

  <!-- Load Ably client -->
  <script src="https://cdn.ably.com/lib/ably.min-1.js"></script>

  <!-- Load the widget -->
  <script
    src="/widget/dist/widget.js"
    data-widget-key="${WIDGET_KEY}"
    data-api-url="http://localhost:${PORT}"
    defer></script>

  <!-- Register the Ably transport plugin BEFORE the widget connects -->
  <script>
    (function () {
      function register() {
        if (!window.RelayWebchat) { setTimeout(register, 30); return; }
        window.RelayWebchat.registerTransport('ably', (info, cb, ctx) => {
          let ably;
          return {
            connect() {
              ably = new Ably.Realtime({
                authCallback: (_, done) => done(null, info.tokenRequest)
              });
              const ch = ably.channels.get('conversation:' + ctx.conversationId);
              ch.subscribe('new_message', (m) => cb.onMessage(m.data?.message || m.data));
            },
            close() { try { ably?.close(); } catch (_e) { /* noop */ } }
          };
        });
      }
      register();
    })();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Ably reference demo running at http://localhost:${PORT}`);
});
