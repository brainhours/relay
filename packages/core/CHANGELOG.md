# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2024-12-30

### Added

- **UnipilePostsManager** - LinkedIn post operations
  - `create(params)` - Create new post (text, images, videos, documents)
  - `getOne(params)` - Get post by ID
  - `getUserPosts(params)` - List posts from a user
  - `getCompanyPosts(params)` - List posts from a company
  - `search(params)` - Search posts by keywords and filters
  - `delete(params)` - Delete a post

- **UnipileReactionsManager** - Post reaction operations
  - `add(params)` - Add reaction (LIKE, CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, FUNNY)
  - `remove(params)` - Remove reaction
  - `list(params)` - List all reactions on a post

- **UnipileCommentsManager** - Post comment operations
  - `create(params)` - Create comment with optional mentions
  - `reply(params)` - Reply to a specific comment (thread)
  - `list(params)` - List all comments on a post
  - `delete(params)` - Delete a comment

- **UnipileCompanyManager** - Company operations
  - `getOne(params)` - Get company profile by ID or vanity name
  - `search(params)` - Search companies with filters
  - `getPosts(params)` - List company posts
  - `getEmployees(params)` - Search company employees

- **UnipileJobsManager** - Job search operations
  - `search(params)` - Search jobs with filters (location, experience, type, remote)
  - `getOne(params)` - Get job details

- **Extended UnipileSearchParamsManager**
  - `skills(params)` - Skills autocomplete
  - `schools(params)` - Schools/universities autocomplete

- **Extended UnipileLinkedInManager** - Advanced search filters
  - `first_name`, `last_name` - Name search
  - `skills` - Skills filter
  - `school` - School filter
  - `past_companies` - Previous companies filter
  - `network_distance` - Connection degree (1st, 2nd, 3rd)
  - `tenure` - Years at current company
  - `years_experience` - Total experience
  - `profile_language` - Profile language
  - `url` - Direct LinkedIn URL search
  - Support for `sales_navigator` and `recruiter` APIs
  - `searchByUrl(params)` - Search using LinkedIn URL directly

- **Extended UnipileUserManager**
  - Enhanced `getFullProfile()` documentation with all enrichment fields
  - `getByPublicIdentifier(params)` - Get user by vanity URL

- **Constants**
  - `REACTION_TYPES` - Available LinkedIn reaction types

### Changed

- `UnipileProvider` now includes new managers: `posts`, `reactions`, `comments`, `company`, `jobs`
- LinkedIn search now supports category: 'people', 'companies', 'jobs', 'posts'
- Increased timeout for search operations to 60 seconds
- All array parameters are automatically normalized

### Notes

- Posts and comments support mentions using `{{0}}`, `{{1}}` placeholders
- Company identifier accepts vanity name, ID, or URN
- URL search allows pasting LinkedIn search URLs directly
- Full profile enrichment returns skills, certifications, languages, projects, and more

## [1.2.1] - 2024-12-30

### Changed

- Updated all documentation with correct package name `@guilhermegoulart1/relay-core`
- Enhanced README with complete API reference
- Updated examples with proper installation instructions
- Added `.env.example` template

## [1.2.0] - 2024-12-30

### Added

- **UnipileSearchParamsManager** - LinkedIn search parameters autocomplete
  - `locations(params)` - Search for cities, regions, countries
  - `industries(params)` - Search for industries/sectors
  - `jobTitles(params)` - Search for job titles
  - `companies(params)` - Search for companies

### Changed

- `UnipileProvider` now includes `searchParams` manager accessible via `provider.searchParams`

### Notes

- All search params methods require `account_id` and `keywords`
- Uses Unipile's `/linkedin/search/parameters` endpoint
- Useful for autocomplete fields in campaign/search forms

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
