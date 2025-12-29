# Express Webhook Example

This example demonstrates how to use `@relay/core` with Express.js to handle Unipile webhooks.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set environment variables:

```bash
export UNIPILE_DSN="your-dsn.unipile.com:13111"
export UNIPILE_ACCESS_TOKEN="your-access-token"
```

3. Run the server:

```bash
npm start
```

## Endpoints

- `POST /webhooks/unipile` - Webhook handler for Unipile events
- `GET /health` - Health check endpoint
- `GET /api/chats?account_id=xxx` - List chats for an account
- `POST /api/messages` - Send a message

## Testing Webhooks

You can use ngrok or similar to expose your local server:

```bash
ngrok http 3000
```

Then configure your Unipile webhook URL to: `https://your-ngrok-url.ngrok.io/webhooks/unipile`

## Event Handling

The example registers handlers for:

- `MESSAGE_RECEIVED` - Handles incoming messages with auto-reply
- `RELATION_CREATED` - Logs new connections
- `ACCOUNT_CONNECTED` - Logs account connection events

You can add more handlers by using the `emitter.on()` method with any `EventTypes` value.
