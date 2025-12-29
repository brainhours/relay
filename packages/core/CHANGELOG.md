# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2024-12-29

### Added

- **UnipileWebhookManager** - Programmatic webhook management
  - `create(options)` - Create webhook with account_ids filter
  - `list()` - List all webhooks
  - `delete(webhookId)` - Delete a webhook
  - `findByUrl(url)` - Find webhooks by URL
  - `findByAccountId(accountId)` - Find webhooks by account
  - `ensureWebhook(options)` - Create webhook if not exists
  - `addAccountToWebhook(url, accountId, source)` - Add account to webhook filter
  - `removeAccountFromWebhook(url, accountId, source)` - Remove account from webhook
  - `getAccountIds(url, source)` - Get current account_ids for a webhook

### Changed

- `UnipileProvider` now includes `webhooks` manager accessible via `provider.webhooks`
- Webhook `create()` now accepts `account_ids` array for filtering events by account

### Notes

- Unipile API has no UPDATE endpoint, so `addAccountToWebhook` and `removeAccountFromWebhook` use DELETE + CREATE pattern
- `account_ids` returned by Unipile API are objects `{id, type, name}`, methods handle both formats

## [1.0.0] - 2024-12-29

### Added

- Initial release
- UnipileProvider with full API support
  - Account management (connect, disconnect, status)
  - User operations (profile, search)
  - Messaging (send, receive, attachments)
  - LinkedIn specific features (search, connections)
- Normalized event system
- Webhook parsing and validation
- Optional Bull queue integration
- TypeScript type definitions
