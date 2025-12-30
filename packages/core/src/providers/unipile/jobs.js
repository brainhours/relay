/**
 * Unipile Jobs Manager
 * Handles LinkedIn job operations: search, get details
 *
 * @see https://developer.unipile.com/reference
 */

/**
 * Manager for LinkedIn job operations
 */
class UnipileJobsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Search for jobs
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} [params.keywords] - Search keywords (job title, skills, company)
   * @param {string|string[]} [params.location] - Location filter (ID or array of IDs)
   * @param {string} [params.date_posted] - Filter: 'past_24_hours', 'past_week', 'past_month'
   * @param {string} [params.experience_level] - Filter: 'internship', 'entry_level', 'associate', 'mid_senior', 'director', 'executive'
   * @param {string} [params.job_type] - Filter: 'full_time', 'part_time', 'contract', 'temporary', 'internship', 'volunteer', 'other'
   * @param {string} [params.remote] - Filter: 'on_site', 'remote', 'hybrid'
   * @param {string|string[]} [params.company] - Company filter (ID or array of IDs)
   * @param {string|string[]} [params.industry] - Industry filter
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
      date_posted,
      experience_level,
      job_type,
      remote,
      company,
      industry,
      limit = 25,
      cursor,
      api = 'classic'
    } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    const body = {
      category: 'jobs',
      api,
      limit
    };

    if (keywords) body.keywords = keywords;
    if (location) body.location = Array.isArray(location) ? location : [location];
    if (date_posted) body.date_posted = date_posted;
    if (experience_level) body.experience_level = experience_level;
    if (job_type) body.job_type = job_type;
    if (remote) body.remote = remote;
    if (company) body.company = Array.isArray(company) ? company : [company];
    if (industry) body.industry = Array.isArray(industry) ? industry : [industry];
    if (cursor) body.cursor = cursor;

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }

  /**
   * Get job details by ID
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.job_id - Job ID (required)
   * @returns {Promise<Object>}
   */
  async getOne(params) {
    const { account_id, job_id } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    if (!job_id) {
      throw new Error('job_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/jobs/${job_id}?account_id=${account_id}`;

    return this.provider.request({
      method: 'GET',
      url,
      timeout: 30000
    });
  }
}

module.exports = { UnipileJobsManager };
