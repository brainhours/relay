# Relay

<p align="center">
  <strong>Unified messaging integrations for Node.js applications</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#packages">Packages</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#supported-channels">Channels</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## Features

- **Multi-provider support** - Unipile, Twilio, Uazapi (coming soon)
- **Normalized events** - Consistent event format across all messaging providers
- **Webhook handling** - Built-in parsing, validation, and queue management
- **Channel agnostic** - LinkedIn, WhatsApp, Instagram, Telegram, SMS, Email
- **Production ready** - Battle-tested in high-volume B2B applications
- **TypeScript support** - Full type definitions included

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@guilhermegoulart1/relay-core](./packages/core) | 1.2.1 | Core messaging integrations |

---

## Quick Start

### 1. Install

```bash
# Configure npm for GitHub Packages
echo "@guilhermegoulart1:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# Install
npm install @guilhermegoulart1/relay-core
```

### 2. Configure Environment

```env
# .env
UNIPILE_DSN=api1.unipile.com:13111
UNIPILE_ACCESS_TOKEN=your_token_here
```

### 3. Initialize

```javascript
const { UnipileProvider } = require('@guilhermegoulart1/relay-core');
require('dotenv').config();

const provider = new UnipileProvider({
  dsn: process.env.UNIPILE_DSN,
  accessToken: process.env.UNIPILE_ACCESS_TOKEN
});

// Send a message
await provider.messaging.sendMessage({
  account_id: 'account_id',
  chat_id: 'chat_id',
  text: 'Hello from Relay!'
});
```

### 4. Handle Webhooks

```javascript
const { parseWebhook, EventTypes } = require('@guilhermegoulart1/relay-core');

app.post('/webhooks/unipile', (req, res) => {
  const event = parseWebhook('unipile', req.body);

  if (event.type === EventTypes.MESSAGE_RECEIVED) {
    console.log('New message:', event.content);
  }

  res.status(200).send('OK');
});
```

---

## Supported Channels

| Channel | Provider | Status |
|---------|----------|--------|
| LinkedIn | Unipile | Stable |
| WhatsApp | Unipile | Stable |
| Instagram | Unipile | Stable |
| Telegram | Unipile | Stable |
| Messenger | Unipile | Stable |
| Email | Unipile | Stable |
| SMS | Twilio | Coming Soon |

---

## API Capabilities

### Account Management
- OAuth hosted authentication
- Direct credential connection
- Account status monitoring
- Multi-account support

### Messaging
- Send/receive messages
- File attachments
- Message reactions
- Read receipts
- Chat history

### LinkedIn Specific
- Profile search (1st, 2nd, 3rd degree)
- Connection requests (invites)
- Full profile data (experiences, education, skills)
- Search parameters autocomplete (locations, industries, job titles, companies)

### Webhooks
- Real-time event notifications
- Normalized event format
- Programmatic webhook management
- Account filtering

---

## Documentation

See the [packages/core README](./packages/core/README.md) for complete API documentation.

### Key Topics

- [Installation](./packages/core/README.md#installation)
- [Environment Variables](./packages/core/README.md#environment-variables)
- [Account Management](./packages/core/README.md#account-management)
- [Messaging](./packages/core/README.md#messaging)
- [LinkedIn Search](./packages/core/README.md#linkedin-search)
- [Search Parameters](./packages/core/README.md#search-parameters-autocomplete)
- [Webhooks](./packages/core/README.md#webhooks)
- [Events](./packages/core/README.md#events)
- [Error Handling](./packages/core/README.md#error-handling)

---

## Examples

Check out the [examples](./examples) directory:

- [Express Webhook Handler](./examples/express-webhook) - Basic webhook processing

---

## Changelog

See [CHANGELOG.md](./packages/core/CHANGELOG.md) for version history.

### Recent Updates

**v1.2.0** (2024-12-30)
- Added `searchParams` manager for LinkedIn autocomplete (locations, industries, job titles, companies)

**v1.1.0** (2024-12-29)
- Added `webhooks` manager for programmatic webhook management

**v1.0.0** (2024-12-29)
- Initial release with Unipile provider

---

## Getting Unipile Credentials

1. Go to [Unipile Dashboard](https://app.unipile.com)
2. Create an account or sign in
3. Navigate to **Settings > API**
4. Copy your **DSN** and **Access Token**

---

## Requirements

- Node.js >= 18.0.0
- npm or yarn
- Unipile account (for Unipile provider)

---

## License

[MIT](./LICENSE) - Guilherme Goulart
