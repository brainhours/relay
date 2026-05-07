# Uazapi Webhook Example

Express app demonstrating the Uazapi (WhatsApp) provider in
`@guilhermegoulart1/relay-core`.

What it shows:
- Provisioning new WhatsApp instances across a cluster of Uazapi
  subscriptions with **heterogeneous capacities** and a configurable
  selection strategy (round-robin, weighted-round-robin, least-loaded,
  fill-first, or custom).
- Configuring per-instance webhooks programmatically.
- Receiving and normalizing webhook events through `parseWebhook`
  + `MessagingEventEmitter`.
- An offline smoke test (`test-smoke.js`) that validates parser and pool
  behavior without hitting the network.

## Setup

```bash
cd examples/uazapi-webhook
npm install
cp .env.example .env
# edit .env with your Uazapi credentials and a public URL
```

`PUBLIC_URL` must be reachable from Uazapi servers — use ngrok / cloudflared
for local development.

## Running

```bash
npm start
```

## Running the offline smoke test

```bash
npm run test:smoke
```

This validates parser and pool logic without hitting the network — useful in
CI.

## Provisioning a new WhatsApp instance

```bash
curl -X POST http://localhost:3000/api/connect \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"acme"}'
# => { tenantId, instanceId, serverId, qrcode (base64 PNG), paircode }
```

Open the `qrcode` (base64 PNG) and scan it with WhatsApp on the phone.

When the connection succeeds the example logs:

```
[conn]   instance <id> connected
```

## Sending a message

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"acme","number":"5511999999999","text":"olá"}'
```

## Inspecting the pool

```bash
curl http://localhost:3000/api/pool | jq
```

Returns the current state of all servers including `load` (when
`getServerLoad` is configured).

## Configuring multiple Uazapi subscriptions

Set `UAZ_SERVERS` in `.env` to a JSON array. Each entry is one Uazapi
subscription (each subscription has its own subdomain + admin token):

```bash
UAZ_SERVERS=[
  {"id":"plano-pequeno","baseUrl":"https://srv1.uazapi.com","adminToken":"tk1","capacity":2},
  {"id":"plano-medio",  "baseUrl":"https://srv2.uazapi.com","adminToken":"tk2","capacity":4},
  {"id":"plano-grande", "baseUrl":"https://srv3.uazapi.com","adminToken":"tk3","capacity":10}
]
UAZ_STRATEGY=weighted-round-robin
```

The example registers an in-memory `getServerLoad` callback so
`least-loaded` and `fill-first` work out of the box. In production, replace
that with a query to your real database.
