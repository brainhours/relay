# Webchat — zero-dep example

Demonstrates the webchat provider end-to-end with **no external services**:

- `InMemoryWebchatStorage` for visitors / messages / channel config
- `SSERealtimeAdapter` for realtime fan-out (browser-native EventSource)
- `MessagingEventEmitter` receiving `NormalizedEvent.MESSAGE_RECEIVED` for every
  visitor message, just like Unipile and Uazapi messages
- The widget bundle is served from `node_modules/@brainhours/relay-webchat-widget/dist/`

## Run

```bash
npm install
npm start
```

Open <http://localhost:3000>. Click the chat launcher in the bottom-right,
send a message, and an echo bot replies in real time over SSE.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                          │
│    <script data-widget-key=... data-api-url=...></script>         │
│    EventSource('/api/public/webchat/_relay/sse?...')              │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP + SSE
┌────────────────────▼────────────────────────────────────────────┐
│  Express (this file)                                              │
│    app.use('/api/public/webchat', createWebchatHandler({           │
│      storage: new InMemoryWebchatStorage(),                       │
│      realtime: new SSERealtimeAdapter(),                          │
│      emitter: new MessagingEventEmitter()                         │
│    }))                                                            │
└─────────────────────────────────────────────────────────────────┘
```

For a multi-pod / production-grade setup, swap `InMemoryWebchatStorage` for
your DB-backed adapter and `SSERealtimeAdapter` for an Ably/Pusher/Redis
adapter (see [examples/webchat-ably/](../webchat-ably/) for an Ably reference).
