/**
 * Unipile Reactions Manager
 * Handles LinkedIn post reaction operations: add, remove, list
 *
 * @see https://developer.unipile.com/docs/posts-and-comments
 */

/**
 * Available reaction types on LinkedIn
 */
const REACTION_TYPES = {
  LIKE: 'LIKE',
  CELEBRATE: 'CELEBRATE',
  SUPPORT: 'SUPPORT',
  LOVE: 'LOVE',
  INSIGHTFUL: 'INSIGHTFUL',
  FUNNY: 'FUNNY'
};

/**
 * Manager for LinkedIn post reactions
 */
class UnipileReactionsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Add a reaction to a post
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @param {string} [params.reaction_type='LIKE'] - Reaction type: LIKE, CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, FUNNY
   * @returns {Promise<Object>}
   */
  async add(params) {
    const { account_id, post_id, reaction_type = 'LIKE' } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    // Validate reaction type
    const validTypes = Object.values(REACTION_TYPES);
    const normalizedType = reaction_type.toUpperCase();
    if (!validTypes.includes(normalizedType)) {
      throw new Error(`Invalid reaction_type. Must be one of: ${validTypes.join(', ')}`);
    }

    const url = `${this.provider.getBaseUrl()}/posts/${post_id}/reactions?account_id=${account_id}`;

    return this.provider.request({
      method: 'POST',
      url,
      data: { reaction_type: normalizedType },
      timeout: 30000
    });
  }

  /**
   * Remove a reaction from a post
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @returns {Promise<Object>}
   */
  async remove(params) {
    const { account_id, post_id } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/posts/${post_id}/reactions?account_id=${account_id}`;

    return this.provider.request({
      method: 'DELETE',
      url,
      timeout: 30000
    });
  }

  /**
   * List all reactions on a post
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

    let url = `${this.provider.getBaseUrl()}/posts/${post_id}/reactions?account_id=${account_id}&limit=${limit}`;

    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    return this.provider.request({
      method: 'GET',
      url,
      timeout: 30000
    });
  }
}

module.exports = { UnipileReactionsManager, REACTION_TYPES };
