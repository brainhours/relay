/**
 * Unipile Company Manager
 * Handles LinkedIn company operations: get profile, search, list posts
 *
 * @see https://developer.unipile.com/reference
 */

/**
 * Manager for LinkedIn company operations
 */
class UnipileCompanyManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Get a company profile by ID or identifier
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.identifier - Company ID, vanity name, or URN (required)
   * @returns {Promise<Object>}
   *
   * @example
   * // Get company by vanity name
   * const company = await company.getOne({
   *   account_id: 'acc_123',
   *   identifier: 'microsoft'
   * });
   *
   * @example
   * // Get company by ID
   * const company = await company.getOne({
   *   account_id: 'acc_123',
   *   identifier: '1035'
   * });
   */
  async getOne(params) {
    const { account_id, identifier } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!identifier) {
      throw new Error('identifier is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/company/${encodeURIComponent(identifier)}?account_id=${account_id}`;

    return this.provider.request({
      method: 'GET',
      url,
      timeout: 30000
    });
  }

  /**
   * Search for companies
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} [params.keywords] - Search keywords
   * @param {string|string[]} [params.location] - Location filter (ID or array of IDs)
   * @param {string|string[]} [params.industry] - Industry filter
   * @param {string} [params.company_size] - Size filter: '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'
   * @param {boolean} [params.has_job_offers] - Filter for companies with open positions
   * @param {number} [params.limit=25] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @param {string} [params.api='classic'] - API to use: 'classic', 'sales_navigator', 'recruiter'
   * @returns {Promise<Object>}
   */
  async search(params) {
    const {
      account_id,
      keywords,
      location,
      industry,
      company_size,
      has_job_offers,
      limit = 25,
      cursor,
      api = 'classic'
    } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    const body = {
      category: 'companies',
      api,
      limit
    };

    if (keywords) body.keywords = keywords;
    if (location) body.location = Array.isArray(location) ? location : [location];
    if (industry) body.industry = Array.isArray(industry) ? industry : [industry];
    if (company_size) body.company_size = company_size;
    if (has_job_offers !== undefined) body.has_job_offers = has_job_offers;
    if (cursor) body.cursor = cursor;

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }

  /**
   * Get posts from a company
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.company_id - Company ID or identifier (required)
   * @param {number} [params.limit=25] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>}
   */
  async getPosts(params) {
    const { account_id, company_id, limit = 25, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!company_id) {
      throw new Error('company_id is required');
    }

    let url = `${this.provider.getBaseUrl()}/companies/${encodeURIComponent(company_id)}/posts?account_id=${account_id}&limit=${limit}`;

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
   * Get company employees
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.company_id - Company ID or identifier (required)
   * @param {string} [params.keywords] - Filter employees by keywords
   * @param {string|string[]} [params.job_title] - Filter by job title
   * @param {number} [params.limit=25] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>}
   */
  async getEmployees(params) {
    const { account_id, company_id, keywords, job_title, limit = 25, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!company_id) {
      throw new Error('company_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    const body = {
      category: 'people',
      api: 'classic',
      companies: [company_id],
      limit
    };

    if (keywords) body.keywords = keywords;
    if (job_title) body.job_title = Array.isArray(job_title) ? job_title : [job_title];
    if (cursor) body.cursor = cursor;

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }
}

module.exports = { UnipileCompanyManager };
