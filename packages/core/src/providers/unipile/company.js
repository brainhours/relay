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
   *
   * Internally hits POST /linkedin/search with category=people and a company
   * filter. Requires the **numeric** LinkedIn company ID — vanity slugs
   * (e.g. "rocket-chat") are silently ignored by Unipile and produce a
   * filterless people search (= random results from the logged user's
   * network). Resolve the slug via `getOne()` first if needed.
   *
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.company_id - Numeric LinkedIn company ID (required)
   * @param {string} [params.keywords] - Filter employees by keywords
   * @param {string|string[]} [params.job_title] - Filter by job title
   * @param {number} [params.limit=25] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>}
   */
  async getEmployees(params) {
    const { account_id, company_id, keywords, job_title, location, limit = 25, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!company_id) {
      throw new Error('company_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    // Classic API expects `company` (singular) — the plural `companies` was a
    // long-standing bug here that caused filterless people searches. Mirrors
    // the convention applied in `linkedin.search` since v1.7.9.
    const body = {
      category: 'people',
      api: 'classic',
      company: [String(company_id)],
      limit
    };

    if (keywords) body.keywords = keywords;
    if (job_title) body.job_title = Array.isArray(job_title) ? job_title : [job_title];
    // Ids de localidade (`/linkedin/search/parameters?type=LOCATION`), nunca
    // texto livre. Array é OU de verdade: medido em 27/08/2026 na Globo,
    // [Rio, São Paulo] devolveu 7 de São Paulo e 3 do Rio na mesma página.
    if (location) body.location = Array.isArray(location) ? location : [location];
    if (cursor) body.cursor = cursor;

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }

  /**
   * List the open job postings of a company.
   *
   * Why this exists: the company profile does NOT carry a vacancy count.
   * `getOne` returns 25 fields and the only one matching /job/ is
   * `viewer_permissions.canCreateJobPosting`, which says whether the
   * authenticated user may publish a job — not how many are open. Verified
   * against the live API on 2026-08-04. Callers that expected `job_count` on the
   * company payload were silently receiving `undefined`.
   *
   * The vacancies come from the jobs search with a company filter — the same
   * shape as `getEmployees` above. This wrapper exists so callers don't have to
   * know that a company-scoped question is answered by a global search endpoint.
   *
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.company_id - Numeric LinkedIn company ID (required)
   * @param {string} [params.date_posted] - 'past_24_hours' | 'past_week' | 'past_month'
   * @param {string|string[]} [params.location] - Location filter (ID or array of IDs)
   * @param {number} [params.limit=25] - Page size
   * @param {string} [params.cursor] - Pagination cursor
   * @returns {Promise<Object>} `{ items, paging, cursor }` — each item carries
   *   title, location, posted_at, url, promoted, easy_apply and company.
   *
   * @example
   * const { items } = await company.getJobs({
   *   account_id: 'acc_123',
   *   company_id: '1441'
   * });
   */
  async getJobs(params) {
    const { account_id, company_id, date_posted, location, limit = 25, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!company_id) {
      throw new Error('company_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    const body = {
      category: 'jobs',
      api: 'classic',
      company: [String(company_id)],
      limit
    };

    if (date_posted) body.date_posted = date_posted;
    if (location) body.location = Array.isArray(location) ? location : [location];
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
