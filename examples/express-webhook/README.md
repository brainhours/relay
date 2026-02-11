# Express Webhook Example

This example demonstrates how to use `@guilhermegoulart1/relay-core` with Express.js to handle Unipile webhooks.

## Setup

### 1. Configure npm for GitHub Packages

Create a `.npmrc` file in this directory:

```
@guilhermegoulart1:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

Create a `.env` file:

```env
UNIPILE_DSN=api1.unipile.com:13111
UNIPILE_ACCESS_TOKEN=your_access_token_here
PORT=3000
```

### 4. Run the server

```bash
npm start
```

Or with auto-reload:

```bash
npm run dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/unipile` | Webhook handler for Unipile events |
| GET | `/health` | Health check endpoint |
| GET | `/api/chats?account_id=xxx` | List chats for an account |
| POST | `/api/messages` | Send a message |

## Testing Webhooks Locally

Use ngrok or similar to expose your local server:

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

## Example: Send a Message

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "your_account_id",
    "chat_id": "your_chat_id",
    "text": "Hello from the API!"
  }'
```

## Example: List Chats

```bash
curl "http://localhost:3000/api/chats?account_id=your_account_id"
```
