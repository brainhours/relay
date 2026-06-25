/**
 * Zernio webhook parser + signature validator.
 *
 * Zernio POSTs webhooks as JSON. Every payload is an envelope:
 *   { id, event, <entity>, ..., timestamp }
 * where `<entity>` is `message` / `post` / `account` / `comment` / `review` /
 * `reaction` depending on the `event`. One event per delivery (1:1, like
 * Twilio/Uazapi — unlike Cloud API which batches).
 *
 * Signature: HMAC-SHA256 of the RAW request body using your configured secret,
 * delivered in the `X-Zernio-Signature` header. Mount express.json with a
 * `verify` hook to capture the raw bytes:
 *
 *   app.use('/webhooks/zernio', express.json({
 *     verify: (req, _res, buf) => { req.rawBody = buf; }
 *   }));
 *
 * @see https://docs.zernio.com/webhooks
 */

const { createHmac, timingSafeEqual } = require('crypto');
const { EventTypes, NormalizedEvent, ProviderTypes } = require('../../events/types');

/**
 * Zernio `event` → normalized EventType. Events without a messaging-centric
 * equivalent (post.*, comment.*, review.*, ad.*) map to UNKNOWN; the raw event
 * is always preserved in `metadata.zernioEvent` so consumers can still branch.
 */
const ZERNIO_EVENT_MAP = Object.freeze({
  'message.received': EventTypes.MESSAGE_RECEIVED,
  'message.sent': EventTypes.MESSAGE_SENT,
  'message.delivered': EventTypes.MESSAGE_DELIVERED,
  'message.read': EventTypes.MESSAGE_READ,
  'message.edited': EventTypes.MESSAGE_EDITED,
  'message.deleted': EventTypes.MESSAGE_DELETED,
  'message.failed': EventTypes.MESSAGE_FAILED,
  'reaction.received': EventTypes.MESSAGE_REACTION,
  'account.connected': EventTypes.ACCOUNT_CONNECTED,
  'account.disconnected': EventTypes.ACCOUNT_DISCONNECTED,
  'account.ads.initial_sync_completed': EventTypes.ACCOUNT_STATUS_CHANGED,
  'whatsapp.template.status_updated': EventTypes.TEMPLATE_STATUS_CHANGED,
  'whatsapp.number.activated': EventTypes.ACCOUNT_STATUS_CHANGED,
  'whatsapp.number.declined': EventTypes.ACCOUNT_STATUS_CHANGED,
  'whatsapp.number.action_required': EventTypes.ACCOUNT_STATUS_CHANGED,
  'whatsapp.number.verification_required': EventTypes.ACCOUNT_STATUS_CHANGED,
  'whatsapp.number.suspended': EventTypes.ACCOUNT_STATUS_CHANGED,
  'whatsapp.number.reactivated': EventTypes.ACCOUNT_STATUS_CHANGED,
  'whatsapp.number.released': EventTypes.ACCOUNT_DISCONNECTED,
  'whatsapp.number.kyc_submitted': EventTypes.ACCOUNT_STATUS_CHANGED
});

/** Zernio platform slug → relay ProviderType (uppercased fallback otherwise). */
const PLATFORM_TO_PROVIDER_TYPE = Object.freeze({
  linkedin: ProviderTypes.LINKEDIN,
  whatsapp: ProviderTypes.WHATSAPP,
  instagram: ProviderTypes.INSTAGRAM,
  facebook: ProviderTypes.FACEBOOK,
  messenger: ProviderTypes.MESSENGER,
  telegram: ProviderTypes.TELEGRAM,
  twitter: ProviderTypes.TWITTER,
  tiktok: ProviderTypes.TIKTOK,
  youtube: ProviderTypes.YOUTUBE,
  pinterest: ProviderTypes.PINTEREST,
  reddit: ProviderTypes.REDDIT,
  bluesky: ProviderTypes.BLUESKY,
  threads: ProviderTypes.THREADS,
  googlebusiness: ProviderTypes.GOOGLEBUSINESS,
  snapchat: ProviderTypes.SNAPCHAT,
  discord: ProviderTypes.DISCORD
});

function mapPlatform(platform) {
  if (!platform) return undefined;
  return PLATFORM_TO_PROVIDER_TYPE[String(platform).toLowerCase()] || String(platform).toUpperCase();
}

/**
 * Parse a Zernio webhook envelope into a NormalizedEvent.
 *
 * @param {Object} rawPayload - the parsed JSON body
 * @returns {NormalizedEvent|null} null if the payload has no `event`
 */
function parseZernioWebhook(rawPayload = {}) {
  const p = rawPayload || {};
  const event = p.event;
  if (!event) return null;

  const type = ZERNIO_EVENT_MAP[event] || EventTypes.UNKNOWN;
  const family = String(event).split('.')[0];

  const account = p.account || {};
  const accountId = account.accountId || account.id || p.accountId || null;

  const base = {
    type,
    provider: 'zernio',
    accountId,
    timestamp: p.timestamp || new Date().toISOString(),
    raw: rawPayload
  };
  const metadata = { zernioEvent: event, eventId: p.id };

  // ── Message / reaction events ──────────────────────────────────────────────
  if (family === 'message' || family === 'reaction') {
    const m = p.message || p.reaction || {};
    const sender = m.sender || {};
    const conv = p.conversation || {};
    const platform = m.platform || conv.platform || account.platform;
    Object.assign(metadata, {
      direction: m.direction,
      platformMessageId: m.platformMessageId,
      isRead: m.isRead,
      phoneNumber: sender.phoneNumber,
      businessScopedUserId: sender.businessScopedUserId,
      contactId: sender.contactId
    });
    return new NormalizedEvent({
      ...base,
      providerType: mapPlatform(platform),
      chatId: m.conversationId || conv.id || null,
      messageId: m.id || m.platformMessageId || null,
      senderId: sender.id || null,
      senderName: sender.name || sender.username || null,
      content: m.text || m.message || '',
      attachments: normalizeAttachments(m.attachments),
      metadata
    });
  }

  // ── Account events ──────────────────────────────────────────────────────────
  if (family === 'account' || family === 'whatsapp') {
    Object.assign(metadata, {
      platform: account.platform,
      profileId: account.profileId,
      username: account.username,
      displayName: account.displayName,
      disconnectionType: account.disconnectionType,
      reason: account.reason
    });
    return new NormalizedEvent({
      ...base,
      providerType: mapPlatform(account.platform),
      senderName: account.displayName || account.username || null,
      metadata
    });
  }

  // ── Comment events ──────────────────────────────────────────────────────────
  if (family === 'comment') {
    const c = p.comment || {};
    const post = p.post || {};
    Object.assign(metadata, { commentId: c.id, postId: post.id, parentId: c.parentId });
    return new NormalizedEvent({
      ...base,
      providerType: mapPlatform(c.platform || account.platform),
      chatId: post.id || null,
      messageId: c.id || null,
      senderId: (c.author && (c.author.id || c.author.username)) || null,
      senderName: (c.author && c.author.name) || null,
      content: c.text || c.message || '',
      metadata
    });
  }

  // ── Review events ───────────────────────────────────────────────────────────
  if (family === 'review') {
    const r = p.review || {};
    Object.assign(metadata, { reviewId: r.id, rating: r.rating });
    return new NormalizedEvent({
      ...base,
      providerType: mapPlatform(r.platform || account.platform),
      messageId: r.id || null,
      senderName: (r.reviewer && r.reviewer.name) || null,
      content: r.text || r.comment || '',
      metadata
    });
  }

  // ── Post / ad / everything else ─────────────────────────────────────────────
  const post = p.post || {};
  Object.assign(metadata, {
    postId: post.id,
    status: post.status,
    platforms: post.platforms,
    platform: (p.platform && p.platform.name) || undefined
  });
  return new NormalizedEvent({
    ...base,
    providerType: mapPlatform((p.platform && p.platform.name) || (post.platforms && post.platforms[0] && post.platforms[0].platform)),
    messageId: post.id || null,
    content: post.content || '',
    metadata
  });
}

/** Normalize a Zernio attachments array into relay's { url, mimeType, id } shape. */
function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((a) => a && a.url)
    .map((a) => ({ url: a.url, mimeType: a.type || a.mimeType, id: a.id, payload: a.payload }));
}

/**
 * Validate the `X-Zernio-Signature` header (HMAC-SHA256 of the raw body).
 *
 * Accepts either a bare hex digest or a `sha256=<hex>` prefixed value. If
 * `secret` is falsy, returns true (dev/test convenience) — set it in production.
 *
 * @param {string|Buffer} rawBody  - the EXACT raw request body bytes
 * @param {string} signatureHeader - value of `X-Zernio-Signature`
 * @param {string} secret          - your configured webhook secret
 * @returns {boolean}
 */
function validateZernioSignature(rawBody, signatureHeader, secret) {
  if (!secret) return true;
  if (typeof signatureHeader !== 'string' || signatureHeader.length === 0) return false;

  const provided = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {}), 'utf-8');
  const expected = createHmac('sha256', secret).update(body).digest('hex');

  try {
    const a = Buffer.from(expected, 'utf-8');
    const b = Buffer.from(provided, 'utf-8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Deterministic job ID for queue dedup (Bull `jobId`, etc.).
 * @param {NormalizedEvent} event
 * @returns {string}
 */
function generateWebhookJobId(event) {
  const eventId = event && event.metadata && event.metadata.eventId;
  return ['zernio', event.type, event.accountId, eventId || event.messageId || event.timestamp]
    .filter(Boolean)
    .join(':');
}

module.exports = {
  parseZernioWebhook,
  validateZernioSignature,
  generateWebhookJobId,
  ZERNIO_EVENT_MAP,
  PLATFORM_TO_PROVIDER_TYPE
};
