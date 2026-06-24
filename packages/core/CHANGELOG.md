# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.17.1] - 2026-06-24

### Fixed

- **Unipile: `posts.create` with attachments now sends `account_id` in the
  multipart form body.** Unipile's multipart `/posts` endpoint validates
  `account_id` from the body and ignores the query-string value, so every media
  post (image / video / document) failed with `400 "account_id required"`.
  Text-only posts were unaffected (JSON body path). Media publishing now works.

## [1.13.0] - 2026-06-12

### Fixed

- **Unipile: `linkedin.search` now emits the correct per-API schema for job
  title, skills and tenure filters.** Previously these were forwarded verbatim
  (e.g. `job_title: ["70"]`) on every API. LinkedIn's **Classic** people search
  has no structured job-title/skills/tenure filter, so those were silently
  ignored — a Classic search by "Marketing Specialist" returned unrelated
  people. The search builder is now API-aware:

  - **`job_title` / `role`** — accepts ids (`"70"`), labels
    (`"Marketing Specialist"`) or objects (`{ id, title }`).
    - Classic → folds the **labels** into `advanced_keywords.title`
      (LinkedIn's native free-text title filter, OR-joined for multiple).
    - Sales Navigator / Recruiter → emits `role: { include: [id] }` against
      the JOB_TITLE taxonomy.
  - **`skills`** — Sales Navigator / Recruiter only; dropped on Classic (fold
    skill terms into `keywords` instead).
  - **`tenure` / `years_experience`** — Sales Navigator only; dropped on
    Classic.
  - **`advanced_keywords`** is now a first-class passthrough
    (`{ first_name, last_name, title, company, school }`) and merges with any
    Classic `job_title` mapping.

### Added

- **Wati provider** (`@guilhermegoulart1/relay-core/providers/wati`): WhatsApp
  Business / BSP integration — `WatiProvider`, messaging/contacts/conversations/
  templates managers, `parseWatiWebhook`, `validateWatiSignature` and the
  `wati` entry in the provider registry / `parseWebhook` / signature dispatch.

## [1.11.0] - 2026-05-14

### Added

- **Uazapi: native support for uazapiGO / wuzapi-based servers** in
  `parseUazapiWebhook`. The hosted product at `uazapi.com` (and any wuzapi
  fork) ships a different webhook payload shape from the classic v2.1 spec
  the parser previously assumed:

  ```json
  {
    "BaseUrl": "https://<sub>.uazapi.com",
    "EventType": "messages" | "messages_update" | "connection",
    "token": "<instance-token>",
    "owner": "<phone>",
    "instanceName": "...",
    "type": "Message" | "ReadReceipt" | ...,
    "event": { ... },                  // for messages_update / connection
    "message": { ... }, "chat": { ... } // for messages
  }
  ```

  Previously, `parseUazapiWebhook` saw `event` as an object (not a channel
  string) and dropped the event with `type=UNKNOWN`, silently breaking
  inbound message delivery on uazapiGO deployments.

  The parser now auto-detects the format from the presence of `BaseUrl` +
  `EventType` at the top level and dispatches to a dedicated uazapiGO branch.
  Classic v2.1 payloads keep their existing behavior — same call site, no
  consumer changes required.

  uazapiGO events covered: `messages` (inbound + outbound), `messages_update`
  (Read / Delivered / Played / Edited / Deleted / Reaction), `connection`
  (connect / disconnect). Unknown channels return a typed `UNKNOWN` event
  preserving the raw payload for debugging.

  Each NormalizedEvent's `metadata.schema` is now `'classic'` or `'uazapiGO'`
  so consumers can tell which branch parsed the event when needed.

### Changed

- `parseUazapiWebhook` is now defensive about timestamps in both branches —
  accepts numeric seconds (10 digits), numeric milliseconds (13 digits), and
  ISO strings, falling back to `new Date()` only when nothing parses.

## [1.10.1] - 2026-05-07

### Fixed

- **Meta WhatsApp Cloud API: `messaging_limit_tier` field deprecated by Meta.**
  Meta silently stopped returning this field around Graph API v22+ even when
  explicitly requested (no error, just absent in the response). This caused
  apps to always see `null` for messaging tier on connect.

  Replacement field is `whatsapp_business_manager_messaging_limit` (same string
  format: `TIER_50`, `TIER_250`, `TIER_1K`, `TIER_10K`, `TIER_100K`, `TIER_UNLIMITED`).

  Updated `MetaCloudApiAccountManager`:
    - `DEFAULT_PHONE_FIELDS` requests the new field.
    - `verifyConnection()` reads `info.whatsapp_business_manager_messaging_limit`
      and exposes it as `tier` (same surface as before).
    - Also added `throughput` and `platformType` to the `verifyConnection` return shape.

  See https://developers.facebook.com/docs/whatsapp/messaging-limits/.

## [1.10.0] - 2026-05-07

### Added

- **Meta WhatsApp Cloud API provider** — official Meta Graph API integration
  alongside Unipile, Uazapi (non-official) and Webchat. Apps using
  `relay-core` can now wire the official Cloud API channel without writing
  the HTTP client, webhook parser or HMAC validator from scratch.

  Architecture: stateless provider, single global endpoint
  (`https://graph.facebook.com/{apiVersion}`), per-call credentials
  (`accessToken`, `phoneNumberId`, `businessAccountId`). Multi-tenancy is
  100% in the consuming app — Relay only carries `apiVersion` and
  `appSecret` (used for HMAC).

  Components shipped:
    - `MetaCloudApiProvider` — the provider class
    - 4 managers:
      - `messaging` — sendTemplate, sendText, sendInteractive (button / list /
        cta_url / location_request / flow), sendMedia (mediaId or link),
        sendLocation, sendContacts, sendReaction, markRead
      - `templates` — list, listAll (auto-paginates Meta's cursor-based
        paging), get (by name + language), create, delete (with optional
        per-language hsmId), edit
      - `media` — upload (multipart), download (2-step CDN with Bearer auth),
        getInfo, delete
      - `account` — getPhoneNumber, listPhoneNumbers, getBusinessAccount,
        register, deregister, verifyConnection (handy for setup screens)
    - `MetaApiError` — typed error preserving `metaCode`, `metaSubcode`,
      `metaTitle`, `metaTraceId`, `metaDetails`. Includes `isRetryable()`.
    - `META_ERROR_CODES` — frozen object naming the codes apps usually react
      to (RATE_LIMIT, PHONE_NOT_ON_WHATSAPP, WINDOW_EXPIRED,
      TEMPLATE_NOT_APPROVED, USER_OPTED_OUT, etc.)
    - `parseCloudApiWebhook(rawPayload)` — returns `NormalizedEvent[]`
      (Cloud API batches up to ~100 events per POST). Covers:
        - inbound messages (text, image, audio, video, document, sticker,
          location, contacts, button, interactive button_reply / list_reply /
          nfm_reply, reaction)
        - statuses (sent, delivered, read, **failed** — see new event type)
        - **`message_template_status_update`** → emits new
          `EventTypes.TEMPLATE_STATUS_CHANGED` (apps that listen react to
          template status changes without polling Meta)
        - `account_update`, `business_capability_update`,
          `phone_number_quality_update`, `phone_number_name_update`
        - change-level errors → `MESSAGE_FAILED`
    - `validateCloudApiSignature(rawBody, header, appSecret)` — HMAC-SHA256
      validation against `X-Hub-Signature-256`, with `timingSafeEqual`.
      App must capture raw body in Express via `verify` callback.
    - `generateCloudApiWebhookJobId(event)` — deterministic dedup key for
      Bull queue.
    - Helpers (opt-in, pure functions, no Redis/BullMQ inside):
      - `effectiveDailyLimit(tier, marginPct)` — accepts numeric tiers
        (250, 1000, …) AND Meta's string format (`'TIER_1K'`,
        `'TIER_100K'`, `'TIER_UNLIMITED'`)
      - `stableVariant(key, { variants, salt })` — SHA-1 stable A/B split
        for mass send
      - `isInWindow(lastInboundAt, windowMs?)` — 24h customer-service window check

  Wiring:
    - `createProvider('cloud-api', config)` works in the factory
    - `parseWebhook('cloud-api', payload)` returns the array
    - `validateWebhookSignature('cloud-api', rawBody, header, secret)` delegates
    - `MetaCloudApiProvider` exported from package root and from
      `@guilhermegoulart1/relay-core/providers/cloud-api`

### New EventTypes

- `MESSAGE_FAILED` — `'message.failed'`. Cloud API emits this for
  `statuses[].status === 'failed'` and for change-level `errors[]`. Generic
  enough to back-port to Unipile/Uazapi later.
- `TEMPLATE_STATUS_CHANGED` — `'template.status_changed'`. Cloud API
  `message_template_status_update`. `NormalizedEvent.isTemplateEvent()`
  helper added.

### Examples

- `examples/cloud-api/` — Express demo with webhook GET handshake + POST
  with HMAC, send template endpoint, verify-connection endpoint, and
  `test-smoke.js` covering 33 offline scenarios (parser, signature,
  helpers, errors, factory wiring).

## [1.9.0] - 2026-05-07

### Added

- **Webchat provider** — first-party embeddable chat channel.

  Webchat is the third channel after Unipile and Uazapi, but architecturally
  different: it is the consuming app's own server, not a wrapper around a
  third-party API. The provider ships the protocol contract (HTTP routes,
  realtime hooks, NormalizedEvent emission) and lets the app inject Storage
  and Realtime adapters for full control.

  Components:
    - `WebchatProvider` — provider class with a messaging manager that
      sends agent/AI messages to visitors (mirrors the API of Unipile/Uazapi
      messaging managers; emits `MESSAGE_SENT` on the configured emitter).
    - `createWebchatHandler({ storage, realtime, emitter })` — Express
      Router factory mounting the 5 public routes:
      `GET /:widgetKey/config`, `POST /:widgetKey/session`,
      `POST /:widgetKey/message`, `POST /:widgetKey/identify`,
      `GET /:widgetKey/history`. Includes dynamic CORS (looks up
      `channel.allowed_origins`), default rate limiting (uses
      `express-rate-limit` if installed), 256kb JSON body parser, and
      ownership checks on every visitor request.
    - `WebchatStorageAdapter` — abstract contract apps implement against
      their own database. Relay never touches SQL.
    - `WebchatRealtimeAdapter` — abstract contract for realtime fan-out.
      The adapter publishes events server-side AND tells the widget how to
      receive them (via `getWidgetConnectionInfo`).
    - `SSERealtimeAdapter` — zero-dependency default. Server-Sent Events
      over HTTP using only Node + Express built-ins. Single-process; for
      multi-pod deployments apps write a Redis/NATS adapter (or use a
      hosted service like Ably — see `examples/webchat-ably`).
    - `InMemoryWebchatStorage` — zero-dependency default storage for
      examples and POCs.
    - `parseWebchatWebhook(payload)` — converts a webchat message payload
      to a `NormalizedEvent`. Visitor messages → `MESSAGE_RECEIVED`;
      agent/AI messages → `MESSAGE_SENT`. Fully symmetric with Unipile and
      Uazapi events, so handlers written for one provider work for all.
    - `parseWebhook('webchat', payload)` registered in the provider factory.

  **Deliberately not shipped**: adapters for Ably, Pusher, or any paid
  third-party service. The contract is open and `examples/webchat-ably/`
  shows a 50-LOC reference implementation that apps can copy.

  New types:
    - `ProviderTypes.WEBCHAT = 'WEBCHAT'`

  New peer dependencies (all optional):
    - `express ^4.18` — required only when `createWebchatHandler` is called
    - `express-rate-limit ^7.0` — used as default rate limiter when present

  New companion package: `@guilhermegoulart1/relay-webchat-widget@1.0.0` —
  vanilla-JS embeddable widget (~17kb minified) with built-in SSE and
  WebSocket transports, plus a `RelayWebchat.registerTransport(name, factory)`
  plugin slot for custom transports (Ably, Pusher, etc.).

  See [docs/providers.md](../../docs/providers.md) and
  [examples/webchat](../../examples/webchat) for setup.

## [1.8.0] - 2026-05-06

### Added

- **Uazapi provider** – first-class WhatsApp support via the
  [Uazapi](https://docs.uazapi.com/) API (uazapiGO 2.1.0), alongside the
  existing Unipile provider.

  Multi-server architecture: the provider holds a configurable cluster of
  Uazapi subscriptions (each with its own `baseUrl`, `adminToken`, and
  `capacity`). When you create a new instance the pool picks a server using
  one of five built-in strategies (or a custom function), so you can spread
  WhatsApp instances across multiple Uazapi accounts with heterogeneous
  capacities.

  - Selection strategies:
    - `pinned` – always one server (default for single-server pools)
    - `round-robin` – cycles through enabled, non-full servers
    - `weighted-round-robin` – Smooth WRR (Nginx-style); proportional to weight/capacity
    - `least-loaded` – picks the server with the lowest `load/capacity` ratio
    - `fill-first` – fills one server up to capacity before moving on
    - `function(eligible, ctx) => server` – custom logic
  - Runtime reconfiguration: `pool.add()`, `pool.update(id, patch)`,
    `pool.remove(id)`, `pool.enable(id)`, `pool.disable(id)`, `pool.stats()`.
  - Per-call override: `instance.create({ serverId })` forces a specific
    server; `instance.create({ strategy })` overrides the strategy.

  Managers shipped:
    - `instance` – create / list / connect (QR or pairing code) / status /
      disconnect / delete / setPresence
    - `messaging` – sendText, sendMedia, sendContact, sendLocation, sendMenu
      (button/list/poll/carousel), react, edit, delete, markRead,
      sendPresence, pin, download
    - `chats` – find (with `wa_*` / `lead_*` filters), archive, mute, pin,
      read, details, check, delete
    - `contacts` – list, listPaginated, add, remove
    - `messages` – find, download, historySync
    - `groups` – create, info, list, listPaginated, leave, updateParticipants,
      updateName, updateDescription
    - `profile` – updateName, updateImage
    - `webhooks` – get, set, addOne, update, delete, ensure (idempotent),
      getErrors. Defaults to `excludeMessages: ['wasSentByApi']` to prevent
      webhook loops.

  Webhook normalization:
    - `parseUazapiWebhook(rawPayload)` returns a `NormalizedEvent` with
      `provider: 'uazapi'`, `providerType: ProviderTypes.WHATSAPP`, and types
      refined per channel: `messages` → `MESSAGE_RECEIVED`/`MESSAGE_SENT`
      (via `data.fromMe`); `messages_update` → `MESSAGE_READ`,
      `MESSAGE_DELIVERED`, `MESSAGE_EDITED`, `MESSAGE_DELETED`,
      `MESSAGE_REACTION` (via `data.status`/`edited`/`deleted`/`reaction`);
      `connection` → `ACCOUNT_CONNECTED`/`ACCOUNT_DISCONNECTED` (via
      `data.connected`).
    - `parseWebhook('uazapi', payload)` and `validateWebhookSignature('uazapi', ...)`
      registered in the provider factory.

  Wiring:
    - `UazapiProvider` exported from the package root and from
      `@guilhermegoulart1/relay-core/providers/uazapi`.
    - `createProvider('uazapi', config)` works in the factory.

  See [docs/providers.md](../../docs/providers.md) and
  [examples/uazapi-webhook](../../examples/uazapi-webhook) for full setup.

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
