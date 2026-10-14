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
   * Add a reaction to a post (or to a comment, with comment_id)
   *
   * A rota da v1 é `POST /posts/reaction`, com tudo no CORPO e o tipo em
   * minúsculas. A forma anterior (`POST /posts/{id}/reactions`, account_id na
   * URL, tipo em maiúsculas) não existe: a Unipile devolve 404 "Cannot POST".
   * Medido em 14/10/2026 contra uma conta real — 201 { object: 'ReactionAdded' }.
   *
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.post_id - social_id do post, em URN (required)
   * @param {string} [params.reaction_type='like'] - like, celebrate, support, love, insightful, funny (aceita maiúsculas)
   * @param {string} [params.comment_id] - reage a um comentário do post, não ao post
   * @param {string} [params.as_organization] - reage como uma página que a conta administra
   * @returns {Promise<Object>} { object: 'ReactionAdded' }
   */
  async add(params) {
    const { account_id, post_id, reaction_type = 'like', comment_id, as_organization } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!post_id) {
      throw new Error('post_id is required');
    }

    const tipo = String(reaction_type).toLowerCase();
    // REACTION_TYPES segue em maiúsculas (é o que a listagem devolve e o que
    // quem consome compara); o envio é que pede minúsculas.
    const validTypes = Object.values(REACTION_TYPES).map((v) => v.toLowerCase());
    if (!validTypes.includes(tipo)) {
      throw new Error(`Invalid reaction_type. Must be one of: ${validTypes.join(', ')}`);
    }

    const data = { account_id, post_id, reaction_type: tipo };
    if (comment_id) data.comment_id = comment_id;
    if (as_organization) data.as_organization = as_organization;

    return this.provider.request({
      method: 'POST',
      url: `${this.provider.getBaseUrl()}/posts/reaction`,
      data,
      timeout: 30000
    });
  }

  /**
   * Remover reação NÃO existe na API v1 da Unipile (nem `DELETE /posts/reaction`
   * nem `DELETE /posts/{id}/reactions` — ambos 404, medido em 14/10/2026). Só a
   * v2 tem, em outro host e com outro formato de id. Falha cedo e com clareza
   * em vez de mandar uma requisição que nunca funcionou.
   */
  async remove() {
    const err = new Error('Removing a reaction is not supported by the Unipile v1 API');
    err.code = 'not_supported';
    throw err;
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

    let url = `${this.provider.getBaseUrl()}/posts/${encodeURIComponent(post_id)}/reactions?account_id=${account_id}&limit=${limit}`;

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
