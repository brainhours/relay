# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.11] - 2026-05-02

### Fixed

- **company.getEmployees** - Fixed the `/linkedin/search` payload key. Body
  was emitting `companies: [...]` (plural) but the Classic API expects
  `company: [...]` (singular). With the wrong key, Unipile silently dropped
  the company filter and `category: 'people'` returned a filterless people
  search — i.e. random results from the logged user's network instead of
  the target company's employees.
  - Mirrors the same fix applied to `linkedin.search` in v1.7.9.
  - Now also coerces `company_id` to a string before sending, since Unipile
    rejects numeric types for this field.
  - Doc-comment updated to clarify that **numeric** company IDs are required;
    vanity slugs trigger the same silent failure (resolve via `company.getOne`
    first).

## [1.7.10] - 2026-04-29

### Fixed

- **unipile.account.getHostedAuthLink** - Honour the `reconnect` option to
  reconnect an existing Unipile account instead of always creating a new one.
  - When `options.reconnect` (a Unipile `account_id`) is provided, the request
    now sends `type: 'reconnect'` and `reconnect_account: <id>` to Unipile.
  - Without `options.reconnect`, behaviour is unchanged (`type: 'create'`).
  - Previously, `options.reconnect` was silently dropped and every "reconnect"
    flow produced a brand-new Unipile account, leaving the original disconnected
    account orphaned.

## [1.7.9] - 2026-04-17

### Fixed

- **linkedin.search** - Fixed `company` / `past_company` payload for Classic API.
  - For `api: 'classic'`, filters are now emitted as an array of string IDs
    (e.g. `company: ["1384602"]`) matching the Unipile Classic schema.
  - For `sales_navigator` / `recruiter`, the existing `{ include: [numericId] }`
    format is preserved.
  - Previously, all searches used the Sales Navigator shape, which caused
    Unipile to return `400 Invalid parameters` on Classic searches filtered
    by company.
- **comments / reactions** - URL-encode `post_id` in posts/comments/reactions
  endpoints to avoid broken requests when the ID contains URL-unsafe chars.

### Added

- **posts.getUserPosts** - Accepts an `is_company` flag that appends
  `is_company=true` to the request, supporting LinkedIn company-page posts.

## [1.7.1] - 2026-02-11

### Fixed

- **messaging.send** - Fixed Unipile API endpoint for starting new chats
  - Changed from `POST /messaging/send` (404) to `POST /chats` (correct Unipile endpoint)
  - Moved `account_id` from query string to request body (required by Unipile API)
  - Body now sends `{ account_id, attendees_ids: [user_id], text }`

## [1.6.1] - 2026-01-15

### Fixed

- **handleReceivedInvitation** - Fixed Unipile API integration for accepting/declining LinkedIn invitations
  - Now correctly sends `provider`, `shared_secret`, and `account_id` in request body (required by Unipile API)
  - Added support for `provider` and `shared_secret` parameters
  - Maps 'reject' to 'decline' for API compatibility

## [1.6.0] - 2026-01-11

### Added

- **Extended UnipileUserManager** - LinkedIn invitation management
  - `listSentInvitations(params)` - List all pending sent invitations
  - `listReceivedInvitations(params)` - List all received invitations (pending connection requests)
  - `handleReceivedInvitation(params)` - Accept or decline a received invitation
  - `cancelInvitation(params)` - Cancel/withdraw a sent invitation that is still pending

### Notes

- All invitation methods require `account_id` parameter
- `handleReceivedInvitation` accepts `action: 'accept' | 'decline'` and requires `provider` and `shared_secret` for LinkedIn
- Uses Unipile's `/users/invite/sent` and `/users/invite/received` endpoints

## [1.4.0] - 2026-01-01

### Added

- **Extended UnipileJobsManager** - Job posting operations
  - `create(params)` - Create job posting draft with screening questions and recruiter config
  - `publish(params)` - Publish job draft to LinkedIn (FREE or PROMOTED mode)
  - `delete(params)` - Delete a job posting

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
