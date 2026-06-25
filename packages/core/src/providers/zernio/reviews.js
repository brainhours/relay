/**
 * ZernioReviewsManager — review management for Facebook & Google Business.
 *
 * Two surfaces:
 *   - Unified inbox reviews (`/inbox/reviews`) — cross-platform listing + reply.
 *   - Google Business specifics (`/accounts/{accountId}/gmb-reviews*`) — batch
 *     fetch and reply scoped to a GMB location account.
 */
class ZernioReviewsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /** List reviews across connected accounts. */
  list(params = {}) {
    return this.provider.request({ method: 'GET', path: '/inbox/reviews', params });
  }

  /** Reply to a review. @param {Object} body - { accountId, comment/reply } */
  reply(reviewId, body) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/reviews/${encodeURIComponent(reviewId)}/reply`,
      data: body
    });
  }

  // ── Google Business ─────────────────────────────────────────────────────────

  /** List GMB reviews for a location account. */
  listGmb(accountId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/gmb-reviews`, params });
  }

  /** Batch-fetch GMB reviews. */
  batchGmb(accountId, params = {}) {
    return this.provider.request({ method: 'GET', path: `/accounts/${accountId}/gmb-reviews/batch`, params });
  }

  /** Reply to a GMB review. */
  replyGmb(accountId, reviewId, body) {
    return this.provider.request({
      method: 'POST',
      path: `/accounts/${accountId}/gmb-reviews/${encodeURIComponent(reviewId)}/reply`,
      data: body
    });
  }
}

module.exports = { ZernioReviewsManager };
