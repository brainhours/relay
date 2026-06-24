# Twilio Example

Express app demonstrating the **Twilio (SMS / MMS / WhatsApp)** provider in
`@guilhermegoulart1/relay-core@1.18.0`.

What it shows:
- Webhook POST: `X-Twilio-Signature` validation + `parseTwilioWebhook` →
  `MessagingEventEmitter` dispatch
- Replying inline with **TwiML** (`messagingResponse`) or an empty `<Response/>`
- Sending SMS (`messaging.sendSms`) and WhatsApp (`messaging.sendWhatsApp`)
- Listening to `MESSAGE_RECEIVED` / `SENT` / `DELIVERED` / `READ` / `FAILED`
- An offline smoke test (`test-smoke.js`) covering parser + signature + TwiML +
  error mapping

## Prerequisites

A Twilio account. Briefly:
1. Sign up at https://www.twilio.com/console and grab your **Account SID** and
   **Auth Token**.
2. Buy an SMS-capable number (or use the trial number) → `TWILIO_SMS_FROM`.
3. For WhatsApp, join the [WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/sandbox)
   (number `+14155238886`) or onboard a real WhatsApp sender.

For local dev, expose your server with ngrok / cloudflared / similar:
```
ngrok http 3000
```

## Setup

```bash
cd examples/twilio
npm install
cp .env.example .env
# fill TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, DEMO_TO
```

## Run

```bash
npm start
```

Then in the Twilio Console, point your number's **"A message comes in"** webhook
(and the WhatsApp Sandbox webhook) to:
- **URL**: `https://<your-tunnel>/webhooks/twilio`
- **Method**: `HTTP POST`

The same route also receives **status callbacks** if you pass `statusCallback`
on send.

## Send an SMS

```bash
curl -X POST http://localhost:3000/api/send-sms \
  -H "Content-Type: application/json" \
  -d '{ "to": "+5511999999999", "body": "Olá!" }'
# => { "sid": "SM…", "status": "queued" }
```

## Send a WhatsApp message

> Free-form WhatsApp only works **inside the 24h customer-service window**.
> Outside it, send an approved template via `messaging.sendContentTemplate({ contentSid, ... })`.

```bash
curl -X POST http://localhost:3000/api/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{ "to": "+5511999999999", "body": "Olá pelo WhatsApp!" }'
```

## Verify credentials

```bash
curl http://localhost:3000/api/verify-connection
# => { "ok": true, "sid": "AC…", "friendlyName": "...", "status": "active", "type": "Full" }
```

## Offline smoke test

```bash
npm run test:smoke
```

Validates the parser / signature / TwiML / error mapping without hitting Twilio.
Good for CI.

## Multi-tenant

This demo uses one set of credentials from `.env`. In a real app:
- Persist `(accountSid, authToken, fromNumber)` per tenant (Twilio subaccounts)
- Resolve them at request time via `event.accountId` (= `AccountSid`) and/or
  `event.metadata.to` (the business number)
- Pass the right ones to each `twilio.messaging.*` call and validate webhooks
  with that tenant's Auth Token
- The provider construction stays singleton — only the per-call params change
