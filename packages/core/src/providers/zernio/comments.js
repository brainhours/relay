/**
 * ZernioCommentsManager — social comment management & comment-to-DM.
 *
 * Works across Facebook, Instagram, Twitter/X, Bluesky, Threads, Reddit,
 * YouTube and LinkedIn (capabilities vary). Comments are addressed by the
 * `postId` they belong to plus a `commentId`.
 *
 * `privateReply()` is the comment-to-DM primitive (Instagram/Facebook): reply
 * privately in DMs to whoever commented — supports quick replies / buttons,
 * the recommended pattern for cold inbound capture. Must be used within 7 days
 * of the comment.
 */
class ZernioCommentsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /** List posts that have comments (inbox view). */
  list(params = {}) {
    return this.provider.request({ method: 'GET', path: '/inbox/comments', params });
  }

  /** Get the comment thread for a specific post. */
  getForPost(postId, params = {}) {
    return this.provider.request({
      method: 'GET',
      path: `/inbox/comments/${encodeURIComponent(postId)}`,
      params
    });
  }

  /**
   * Reply (publicly) to a comment on a post.
   * @param {string} postId
   * @param {Object} body - { accountId, commentId, message }
   */
  reply(postId, body) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/comments/${encodeURIComponent(postId)}`,
      data: body
    });
  }

  /** Delete a comment. */
  delete(postId, body) {
    return this.provider.request({
      method: 'DELETE',
      path: `/inbox/comments/${encodeURIComponent(postId)}`,
      data: body
    });
  }

  /** Hide a comment. */
  hide(postId, commentId, body = {}) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/hide`,
      data: body
    });
  }

  /** Unhide a comment. */
  unhide(postId, commentId, body = {}) {
    return this.provider.request({
      method: 'DELETE',
      path: `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/hide`,
      data: body
    });
  }

  /** Like a comment. */
  like(postId, commentId, body = {}) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/like`,
      data: body
    });
  }

  /** Unlike a comment. */
  unlike(postId, commentId, body = {}) {
    return this.provider.request({
      method: 'DELETE',
      path: `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/like`,
      data: body
    });
  }

  /**
   * Send a PRIVATE reply (comment-to-DM) to the commenter (IG/FB).
   * @param {string} postId
   * @param {string} commentId
   * @param {Object} body - { accountId, message, quickReplies?, buttons? }
   */
  privateReply(postId, commentId, body) {
    return this.provider.request({
      method: 'POST',
      path: `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/private-reply`,
      data: body
    });
  }
}

module.exports = { ZernioCommentsManager };
