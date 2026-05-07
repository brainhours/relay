/**
 * Relay Webchat — zero-dependency example.
 *
 * Demonstrates:
 *   - createWebchatHandler factory mounted on Express
 *   - InMemoryWebchatStorage (no DB)
 *   - SSERealtimeAdapter (no Ably/Pusher/Redis)
 *   - MessagingEventEmitter receiving NormalizedEvent for every visitor message
 *   - Serving the widget bundle from node_modules
 *
 * Open http://localhost:3000 to see the widget on a sample page.
 */

const path = require('path');
const express = require('express');
const {
  createWebchatHandler,
  InMemoryWebchatStorage,
  SSERealtimeAdapter,
  WebchatProvider,
  MessagingEventEmitter,
  EventTypes
} = require('@guilhermegoulart1/relay-core');

const PORT = process.env.PORT || 3000;
const WIDGET_KEY = process.env.WIDGET_KEY || 'demo123abcdef0123456789abcdef0123';

// ---------------------------------------------------------------------------
// 1. Storage + realtime + emitter
// ---------------------------------------------------------------------------

const storage = new InMemoryWebchatStorage();
const channel = storage.seedChannel({
  widgetKey: WIDGET_KEY,
  accountId: 'acc-demo',
  agent_name: 'Relay Demo',
  welcome_message: 'Hi! This is a fully zero-dependency demo. Send me a message.',
  pre_chat_form: { enabled: false, fields: [] }
});
console.log('Seeded channel:', channel.id);

const realtime = new SSERealtimeAdapter();
const emitter = new MessagingEventEmitter();

// ---------------------------------------------------------------------------
// 2. Demo handlers — auto-reply, AI symmetry with Unipile/Uazapi
// ---------------------------------------------------------------------------

// The same handler shape works for any provider — filter by providerType.
const provider = new WebchatProvider({ storage, realtime, emitter });

emitter.on(EventTypes.MESSAGE_RECEIVED, async (event) => {
  if (event.providerType !== 'WEBCHAT') return;
  console.log(`[visitor → ${event.senderName || 'anonymous'}] ${event.content}`);

  // Echo bot: reply 600ms later
  setTimeout(() => {
    provider.messaging
      .sendMessage({
        conversationId: event.chatId,
        accountId: event.accountId,
        content: `🤖 Echo: ${event.content}`,
        senderType: 'ai'
      })
      .catch((err) => console.error('reply error:', err));
  }, 600);
});

emitter.on(EventTypes.MESSAGE_SENT, (event) => {
  if (event.providerType !== 'WEBCHAT') return;
  console.log(`[agent → conv ${event.chatId.slice(0, 8)}] ${event.content}`);
});

// ---------------------------------------------------------------------------
// 3. Express
// ---------------------------------------------------------------------------

const app = express();

// Webchat public routes (handler factory)
app.use('/api/public/webchat', createWebchatHandler({ storage, realtime, emitter }));

// Serve the widget bundle from node_modules
const widgetDist = path.join(
  path.dirname(require.resolve('@guilhermegoulart1/relay-webchat-widget/package.json')),
  'dist'
);
app.use('/widget/dist', express.static(widgetDist));

// Demo page
app.get('/', (_req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Relay Webchat — zero-dep demo</title>
  <style>
    body { font-family: system-ui; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #1f2937; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Relay Webchat — zero-dep demo</h1>
  <p>This page runs the widget against a server using only:
     <code>InMemoryWebchatStorage</code> + <code>SSERealtimeAdapter</code> +
     Express. No Postgres, no Ably, no Redis.</p>
  <p>Click the chat button at the bottom right. Type a message and an echo bot
     will reply via SSE. Reload the page — your conversation persists for the
     lifetime of this Node process.</p>
  <script
    src="/widget/dist/widget.js"
    data-widget-key="${WIDGET_KEY}"
    data-api-url="http://localhost:${PORT}"
    defer></script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`\nDemo running at http://localhost:${PORT}`);
  console.log(`Widget key: ${WIDGET_KEY}`);
  console.log(`Pool transport: SSE (zero external deps)\n`);
});
