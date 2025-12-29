# Relay

<p align="center">
  <strong>Unified messaging integrations for Node.js applications</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#providers">Providers</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Features

- **Multi-provider support** - Unipile, Twilio, Uazapi, and more
- **Normalized events** - Consistent event format across all messaging providers
- **Webhook handling** - Built-in parsing, validation, and queue management
- **Channel agnostic** - LinkedIn, WhatsApp, Instagram, Telegram, SMS, and more
- **Production ready** - Battle-tested in high-volume applications
- **TypeScript support** - Full type definitions included

## Installation

```bash
npm install @relay/core
```

## Quick Start

```javascript
const { UnipileProvider, parseWebhook, EventTypes } = require('@relay/core');

// Initialize provider
const unipile = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Send a message
await unipile.messaging.send({
  accountId: 'account_123',
  attendeeId: 'user_456',
  text: 'Hello from Relay!'
});

// Handle webhooks
app.post('/webhooks/unipile', (req, res) => {
  const event = parseWebhook('unipile', req.body);

  switch (event.type) {
    case EventTypes.MESSAGE_RECEIVED:
      console.log('New message:', event.content);
      break;
    case EventTypes.MESSAGE_DELIVERED:
      console.log('Message delivered:', event.messageId);
      break;
  }

  res.status(200).send('OK');
});
```

## Providers

| Provider | Status | Channels |
|----------|--------|----------|
| Unipile | ✅ Stable | LinkedIn, WhatsApp, Instagram, Telegram, Messenger, Email |
| Twilio | 🚧 Coming soon | SMS, WhatsApp, Voice |
| Uazapi | 🚧 Coming soon | WhatsApp |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Providers](./docs/providers.md)
- [Events](./docs/events.md)
- [Webhooks](./docs/webhooks.md)
- [Queue Integration](./docs/queue.md)
- [API Reference](./docs/api.md)

## Examples

Check out the [examples](./examples) directory for complete working examples:

- [Express Webhook Handler](./examples/express-webhook)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## Security

If you discover a security vulnerability, please see our [Security Policy](./SECURITY.md).

## License

[MIT](./LICENSE) © Guilherme Goulart
