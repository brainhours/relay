# Cloud API Example

Express app demonstrating the **official Meta WhatsApp Cloud API** provider in
`@guilhermegoulart1/relay-core@1.10.0`.

What it shows:
- Webhook GET handshake (`hub.verify_token`)
- Webhook POST: HMAC-SHA256 validation + `parseCloudApiWebhook` →
  `MessagingEventEmitter` dispatch
- Sending a template via `meta.messaging.sendTemplate(...)`
- Listening to all event types, including the new `MESSAGE_FAILED` and
  `TEMPLATE_STATUS_CHANGED`
- An offline smoke test (`test-smoke.js`) covering parser + helpers + signature

## Prerequisites

You need a Meta Cloud API setup. Briefly:
1. Create a Meta Business app (https://developers.facebook.com/apps)
2. Add the WhatsApp product
3. Note your `phone_number_id`, `business_account_id`, and System User permanent token
4. Note your **App Secret** (NOT the access token) — used for HMAC validation
5. Configure the webhook URL in the app dashboard (subscribe to `messages`,
   `message_template_status_update`, `account_update`, etc.)

For local dev, expose your server with ngrok / cloudflared / similar:
```
ngrok http 3000
```

## Setup

```bash
cd examples/cloud-api
npm install
cp .env.example .env
# fill META_*, WEBHOOK_VERIFY_TOKEN, DEMO_TO, DEMO_TEMPLATE_NAME, DEMO_TEMPLATE_LANGUAGE
```

## Run

```bash
npm start
```

Then in the Meta app dashboard, configure:
- **Callback URL**: `https://<your-tunnel>/webhooks/meta`
- **Verify token**: same as `WEBHOOK_VERIFY_TOKEN` in your `.env`
- **Subscribe**: `messages`, `message_template_status_update`, `account_update`

## Send a template

```bash
curl -X POST http://localhost:3000/api/send-template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999",
    "templateName": "hello_world",
    "language": "en_US",
    "components": []
  }'
```

For a template with body parameters:
```json
{
  "to": "5511999999999",
  "templateName": "lembrete_renovacao",
  "language": "pt_BR",
  "components": [
    {
      "type": "body",
      "parameters": [{ "type": "text", "text": "Joana" }, { "type": "text", "text": "10/05/2026" }]
    }
  ]
}
```

## Verify credentials

```bash
curl http://localhost:3000/api/verify-connection
# => { ok: true, displayPhoneNumber, verifiedName, qualityRating, tier }
```

## Offline smoke test

```bash
npm run test:smoke
```

Validates parser/signature/helpers without hitting Meta. Good for CI.

## Multi-tenant

This demo uses one set of credentials from `.env`. In a real app:
- Persist `(accessToken, phoneNumberId, businessAccountId, verifyToken)` per tenant
- Resolve them at request time via `event.accountId` (= `phoneNumberId` in webhooks)
- Pass the right ones to each `meta.messaging.*` call
- The provider construction stays singleton — only the per-call params change
