# Webchat with Ably — reference example

> ⚠️ **This is example code, NOT shipped by Relay.** It demonstrates the
> `WebchatRealtimeAdapter` contract. Apps that use Ably (or want to) can
> copy [ably-realtime.js](ably-realtime.js) into their codebase as a
> starting point.

The Relay deliberately ships only the SSE realtime adapter in
`@guilhermegoulart1/relay-core`. Paid third-party services (Ably, Pusher,
PubNub, ...) live as application-level adapters because Relay shouldn't
recommend or default to a paid stack.

## Run

```bash
export ABLY_API_KEY=your-key
npm install
npm start
```

Open <http://localhost:3000>.

## What's different vs the zero-dep example

[../webchat/](../webchat/):
- Backend: `SSERealtimeAdapter` (built in)
- Browser: receives messages via `EventSource`
- Zero external deps

This directory:
- Backend: `AblyWebchatRealtime` (custom adapter living in this example, ~50 LOC)
- Browser: registers a transport plugin via `RelayWebchat.registerTransport('ably', ...)`
- Requires an Ably account + key

## Files

- [ably-realtime.js](ably-realtime.js) — server-side adapter implementing
  `WebchatRealtimeAdapter` (publish + token request)
- [server.js](server.js) — Express setup mounting the handler factory with the
  Ably adapter
- The HTML response in `server.js` shows the widget-side transport plugin
  registration

## Pattern for other realtime services

The same shape works for:
- **Pusher**: replace `ably.channels.get(...).publish(...)` with `pusher.trigger(...)`
- **Centrifugo**: HTTP API publish + token issuance
- **PubNub**: SDK publish + grant tokens
- **Custom WS server**: emit `{ event: 'new_message', data: ... }` JSON frames

Adapt `ably-realtime.js` accordingly. The `WebchatRealtimeAdapter` interface
is the same regardless of transport.
