/**
 * Unipile Comments Manager
 * Handles LinkedIn post comment operations: create, reply, list
 *
 * @see https://developer.unipile.com/docs/posts-and-comments
 */

/**
 * Manager for LinkedIn post comments
 */
class UnipileCommentsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Create a comment on a post
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @param {string} params.text - Comment text (required). Use {{0}}, {{1}} for mentions
   * @param {Array<{name: string, profile_id: string}>} [params.mentions] - Users to mention
   * @returns {Promise<Object>}
   *
   * @example
   * // Simple comment
   * await comments.create({
   *   account_id: 'acc_123',
   *   post_id: 'post_456',
   *   text: 'Great post!'
   * });
   *
   * @example
   * // Comment with mention
   * await comments.create({
   *   account_id: 'acc_123',
   *   post_id: 'post_456',
   *   text: 'Hey {{0}}, check this out!',
   *   mentions: [{ name: 'John Doe', profile_id: 'user_789' }]
   * });
   */
  async create(params) {
    const { account_id, post_id, text, mentions } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    if (!text) {
      throw new Error('text is required');
    }

    const url = `${this.provider.getBaseUrl()}/posts/${encodeURIComponent(post_id)}/comments?account_id=${account_id}`;

    const body = { text };

    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      body.mentions = mentions;
    }

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }

  /**
   * Reply to a specific comment (thread reply)
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @param {string} params.comment_id - Parent comment ID to reply to (required)
   * @param {string} params.text - Reply text (required)
   * @param {Array<{name: string, profile_id: string}>} [params.mentions] - Users to mention
   * @returns {Promise<Object>}
   */
  async reply(params) {
    const { account_id, post_id, comment_id, text, mentions } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    if (!comment_id) {
      throw new Error('comment_id is required');
    }

    if (!text) {
      throw new Error('text is required');
    }

    const url = `${this.provider.getBaseUrl()}/posts/${encodeURIComponent(post_id)}/comments?account_id=${account_id}`;

    const body = {
      text,
      comment_id // This makes it a reply to the specific comment
    };

    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      body.mentions = mentions;
    }

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }

  /**
   * List all comments on a post
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @param {number} [params.limit=50] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>}
   */
  async list(params) {
    const { account_id, post_id, limit = 50, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    let url = `${this.provider.getBaseUrl()}/posts/${encodeURIComponent(post_id)}/comments?account_id=${account_id}&limit=${limit}`;

    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    return this.provider.request({
      method: 'GET',
      url,
      timeout: 30000
    });
  }

  /**
   * Delete a comment
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @param {string} params.comment_id - Comment ID to delete (required)
   * @returns {Promise<Object>}
   */
  async delete(params) {
    const { account_id, post_id, comment_id } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    if (!comment_id) {
      throw new Error('comment_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/posts/${encodeURIComponent(post_id)}/comments/${comment_id}?account_id=${account_id}`;

    return this.provider.request({
      method: 'DELETE',
      url,
      timeout: 30000
    });
  }
}

module.exports = { UnipileCommentsManager };
