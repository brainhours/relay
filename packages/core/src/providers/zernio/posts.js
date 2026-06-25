/**
 * ZernioPostsManager — publishing & scheduling across ALL Zernio channels.
 *
 * A single `create()` call fans out to one or more platforms via the
 * `platforms[]` array (each entry is `{ platform, accountId, customContent?,
 * customMedia?, scheduledFor?, platformSpecificData? }`). The same call publishes
 * immediately (`publishNow: true`), schedules (`scheduledFor`), queues
 * (`queuedFromProfile`), or saves a draft (`isDraft` / no timing).
 *
 * Supported `platform` values: twitter, instagram, facebook, linkedin, tiktok,
 * youtube, pinterest, reddit, bluesky, threads, googlebusiness, telegram,
 * snapchat, discord. (WhatsApp is messaging, not feed posts — use
 * `provider.messaging` / `provider.whatsapp`.)
 *
 * Idempotency: pass an `x-request-id` header (UUID per logical call) to make
 * retries safe; Zernio also content-hash dedups identical posts within 24h
 * (HTTP 409). See the createPost docs.
 */
class ZernioPostsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Create (and optionally publish/schedule/queue) a post.
   * @param {Object} body - createPost body (content, mediaItems, platforms[], publishNow, scheduledFor, isDraft, tags, …)
   * @param {Object} [opts]
   * @param {string} [opts.requestId] - x-request-id idempotency key (UUID).
   * @returns {Promise<Object>}
   */
  create(body, { requestId } = {}) {
    const headers = requestId ? { 'x-request-id': requestId } : undefined;
    return this.provider.request({ method: 'POST', path: '/posts', data: body, headers });
  }

  /** Publish immediately to the given platforms. Thin wrapper over create(). */
  publishNow(body, opts) {
    return this.create({ ...body, publishNow: true }, opts);
  }

  /** Schedule a post for a future time (ISO date-time). */
  schedule(body, scheduledFor, opts) {
    return this.create({ ...body, scheduledFor }, opts);
  }

  /** Save a draft (no timing). */
  draft(body, opts) {
    return this.create({ ...body, isDraft: true }, opts);
  }

  /** List posts. @param {Object} [params] page, limit, status, platform, profileId, accountId, dateFrom/To, search, sortBy */
  list(params = {}) {
    return this.provider.request({ method: 'GET', path: '/posts', params });
  }

  /** Fetch a single post (published posts include platformPostUrl per platform). */
  get(postId) {
    return this.provider.request({ method: 'GET', path: `/posts/${postId}` });
  }

  /** Update a scheduled/draft post. */
  update(postId, body) {
    return this.provider.request({ method: 'PATCH', path: `/posts/${postId}`, data: body });
  }

  /** Delete a post. */
  delete(postId) {
    return this.provider.request({ method: 'DELETE', path: `/posts/${postId}` });
  }

  /** Bulk-create posts from a CSV/payload. */
  bulkUpload(body) {
    return this.provider.request({ method: 'POST', path: '/posts/bulk-upload', data: body });
  }

  /** Retry a failed post. */
  retry(postId) {
    return this.provider.request({ method: 'POST', path: `/posts/${postId}/retry` });
  }

  /** Unpublish an already-published post (where the platform allows). */
  unpublish(postId) {
    return this.provider.request({ method: 'POST', path: `/posts/${postId}/unpublish` });
  }

  /** Edit a published post in place (where the platform allows). */
  edit(postId, body) {
    return this.provider.request({ method: 'POST', path: `/posts/${postId}/edit`, data: body });
  }

  /** Update stored metadata on a post without re-publishing. */
  updateMetadata(postId, body) {
    return this.provider.request({ method: 'POST', path: `/posts/${postId}/update-metadata`, data: body });
  }

  // ── Validation tools (pre-flight; no post is created) ───────────────────────

  /** Validate full post content for the target platforms. */
  validate(body) {
    return this.provider.request({ method: 'POST', path: '/tools/validate/post', data: body });
  }

  /** Validate content length only. */
  validateLength(body) {
    return this.provider.request({ method: 'POST', path: '/tools/validate/post-length', data: body });
  }

  /** Validate media constraints for the target platforms. */
  validateMedia(body) {
    return this.provider.request({ method: 'POST', path: '/tools/validate/media', data: body });
  }

  /** Check whether a subreddit exists / accepts the post. */
  validateSubreddit(body) {
    return this.provider.request({ method: 'POST', path: '/tools/validate/subreddit', data: body });
  }

  // ── Queue (per-profile scheduling slots) ────────────────────────────────────

  /** List queue slots. */
  listQueueSlots(params = {}) {
    return this.provider.request({ method: 'GET', path: '/queue/slots', params });
  }

  /** Create a queue slot. */
  createQueueSlot(body) {
    return this.provider.request({ method: 'POST', path: '/queue/slots', data: body });
  }

  /** Preview the upcoming queued posts. */
  previewQueue(params = {}) {
    return this.provider.request({ method: 'GET', path: '/queue/preview', params });
  }

  /** Get the next available queue slot for a profile. */
  nextQueueSlot(params = {}) {
    return this.provider.request({ method: 'GET', path: '/queue/next-slot', params });
  }
}

module.exports = { ZernioPostsManager };
