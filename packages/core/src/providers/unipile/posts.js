/**
 * Unipile Posts Manager
 * Handles LinkedIn post operations: create, read, list, search
 *
 * @see https://developer.unipile.com/docs/posts-and-comments
 */

/**
 * Manager for LinkedIn post operations
 */
class UnipilePostsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Create a new post
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.text - Post content (required)
   * @param {string} [params.visibility] - Post visibility: 'anyone', 'connections_only'
   * @param {Array<{buffer: Buffer, filename: string, mimetype: string}>} [params.attachments] - Media attachments
   * @returns {Promise<Object>}
   */
  async create(params) {
    const { account_id, text, visibility = 'anyone', attachments } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!text) {
      throw new Error('text is required');
    }

    const url = `${this.provider.getBaseUrl()}/posts?account_id=${account_id}`;

    // If we have attachments, use multipart form
    if (attachments && attachments.length > 0) {
      const FormData = require('form-data');
      const axios = require('axios');
      const formData = new FormData();

      // Unipile's multipart /posts endpoint requires account_id in the form BODY —
      // the query-string account_id is ignored for multipart requests, so without
      // this every media post (image/video/document) fails with 400 "account_id required".
      formData.append('account_id', account_id);
      formData.append('text', text);
      formData.append('visibility', visibility);

      for (const attachment of attachments) {
        formData.append('attachments', attachment.buffer, {
          filename: attachment.filename,
          contentType: attachment.mimetype
        });
      }

      const response = await axios.post(url, formData, {
        headers: {
          'X-API-KEY': this.provider.accessToken,
          ...formData.getHeaders()
        },
        timeout: 60000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024
      });

      return response.data;
    }

    // Simple text post
    return this.provider.request({
      method: 'POST',
      url,
      data: { text, visibility },
      timeout: 30000
    });
  }

  /**
   * Get a specific post by ID
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @returns {Promise<Object>}
   */
  async getOne(params) {
    const { account_id, post_id } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/posts/${post_id}?account_id=${account_id}`;

    return this.provider.request({
      method: 'GET',
      url,
      timeout: 30000
    });
  }

  /**
   * Get all posts from a user
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.user_id - User ID or identifier (required)
   * @param {number} [params.limit=25] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>}
   */
  async getUserPosts(params) {
    const { account_id, user_id, is_company, limit = 25, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!user_id) {
      throw new Error('user_id is required');
    }

    let url = `${this.provider.getBaseUrl()}/users/${user_id}/posts?account_id=${account_id}`;

    if (is_company) {
      url += '&is_company=true';
    }

    url += `&limit=${limit}`;

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
   * Get all posts from a company
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.company_id - Company ID or identifier (required)
   * @param {number} [params.limit=25] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>}
   */
  async getCompanyPosts(params) {
    const { account_id, company_id, limit = 25, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!company_id) {
      throw new Error('company_id is required');
    }

    let url = `${this.provider.getBaseUrl()}/companies/${company_id}/posts?account_id=${account_id}&limit=${limit}`;

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
   * Search posts by keywords and filters
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} [params.keywords] - Search keywords
   * @param {string} [params.sort_by] - Sort order: 'date', 'relevance'
   * @param {string} [params.date_posted] - Filter: 'past_24_hours', 'past_week', 'past_month'
   * @param {string} [params.content_type] - Filter: 'images', 'videos', 'articles'
   * @param {string} [params.author] - Filter by author keywords
   * @param {number} [params.limit=25] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>}
   */
  async search(params) {
    const { account_id, keywords, sort_by, date_posted, content_type, author, limit = 25, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    const body = {
      category: 'posts',
      api: 'classic',
      limit
    };

    if (keywords) body.keywords = keywords;
    if (sort_by) body.sort_by = sort_by;
    if (date_posted) body.date_posted = date_posted;
    if (content_type) body.content_type = content_type;
    if (author) body.author = author;
    if (cursor) body.cursor = cursor;

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }

  /**
   * Delete a post
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - Post ID (required)
   * @returns {Promise<Object>}
   */
  async delete(params) {
    const { account_id, post_id } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/posts/${post_id}?account_id=${account_id}`;

    return this.provider.request({
      method: 'DELETE',
      url,
      timeout: 30000
    });
  }
}

module.exports = { UnipilePostsManager };
