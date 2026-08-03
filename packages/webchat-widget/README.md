# @brainhours/relay-webchat-widget

Embeddable webchat widget for the [@brainhours/relay-core](../core) webchat
provider. Vanilla JS, Shadow DOM, ~5kb gzipped, transport-pluggable.

## Install

```bash
npm install @brainhours/relay-webchat-widget
```

You can also self-host: serve `dist/widget.js` from a static path on your
own server and embed via `<script>`.

## Embed

```html
<script
  src="https://your-app.com/widget/dist/widget.js"
  data-widget-key="YOUR_32_CHAR_HEX_KEY"
  data-api-url="https://your-app.com"
  defer
></script>
```

The `data-api-url` must point to wherever your app has mounted
`createWebchatHandler` from `@brainhours/relay-core` (typically under
`/api/public/webchat`).

## Built-in transports

The widget can receive realtime updates over **two browser-native transports**
out of the box; no extra script needed:

- **Server-Sent Events (SSE)** — default. Used when the backend's
  `/session` response returns `{ realtime: { transport: 'sse', url: '...' } }`.
- **WebSocket** — used when the backend returns
  `{ realtime: { transport: 'websocket', url: '...' } }`.

The choice is decided by the **backend's realtime adapter**, not the widget.
You don't configure transport on the widget; you configure it on the server.

## Custom transports (Ably, Pusher, ...)

Apps that use a paid realtime service register a transport plugin BEFORE
the widget connects. The widget exposes `RelayWebchat.registerTransport`:

```html
<!-- Load Ably first -->
<script src="https://cdn.ably.com/lib/ably.min-1.js"></script>

<!-- Then load the widget -->
<script
  src="https://your-app.com/widget/dist/widget.js"
  data-widget-key="..."
  data-api-url="..."
></script>

<!-- Register the Ably transport -->
<script>
  RelayWebchat.registerTransport('ably', (info, callbacks, ctx) => {
    const ably = new Ably.Realtime({
      authCallback: (_, done) => done(null, info.tokenRequest)
    });
    const ch = ably.channels.get('conversation:' + ctx.conversationId);
    ch.subscribe('new_message', (m) => {
      const message = m.data?.message || m.data;
      callbacks.onMessage(message);
    });
    return { connect() {}, close() { ably.close(); } };
  });
</script>
```

When the backend's realtime adapter returns
`{ transport: 'ably', tokenRequest: <...> }`, the widget will look up and use
your registered transport automatically.

## Imperative API

After load, the widget exposes:

```js
RelayWebchat.open();                          // open the chat window
RelayWebchat.close();                         // close it
RelayWebchat.sendMessage('hello');            // pretend the visitor typed this
RelayWebchat.identify({ name, email, phone, company });  // share identity with the backend
RelayWebchat.registerTransport(name, factory);
```

## Customization

All visual customization happens server-side via the channel config the
backend serves at `GET /:widgetKey/config`:

```json
{
  "theme": {
    "primaryColor": "#6366f1",
    "position": "bottom-right",
    "borderRadius": 16,
    "launcherIcon": "chat",
    "fontFamily": "Inter, system-ui, sans-serif"
  },
  "welcome_message": "Hi! How can we help?",
  "agent_name": "Support",
  "agent_avatar_url": null,
  "pre_chat_form": { "enabled": false, "fields": ["name", "email"] },
  "offline_message": "We're offline — leave a message."
}
```

Available `launcherIcon` values: `chat`, `headset`, `helpCircle`,
`messageCircle`, `sparkles`, `bot`.

## Build locally

```bash
npm install
npm run build      # writes dist/widget.js (minified) and dist/widget.dev.js
npm run dev        # watches src/, rebuilds dist/widget.dev.js on change
```

## Browser support

ES2020 + EventSource + WebSocket. Tested on the last 2 versions of Chrome,
Firefox, Safari, Edge. IE is not supported.
