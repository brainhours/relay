/**
 * Unipile Jobs Manager
 * Handles LinkedIn job operations: search, get details, create, publish, delete
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

  /**
   * Create a job posting draft
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {Object} params.job_title - Job title { text: string }
   * @param {Object} params.company - Company { text: string }
   * @param {string} params.description - Job description (plain text)
   * @param {string} params.location - Location ID
   * @param {string} [params.employment_status='FULL_TIME'] - FULL_TIME, PART_TIME, CONTRACT, etc.
   * @param {string} [params.workplace='HYBRID'] - HYBRID, REMOTE, ON_SITE
   * @param {string[]} [params.skills] - Array of skills
   * @param {Object[]} [params.screening_questions] - Screening questions
   * @param {string} [params.auto_rejection_template] - Auto rejection template
   * @param {Object} [params.recruiter] - Recruiter configuration
   * @returns {Promise<Object>} Returns { job_id, ... }
   */
  async create(params) {
    const {
      account_id,
      job_title,
      company,
      description,
      location,
      employment_status = 'FULL_TIME',
      workplace = 'HYBRID',
      skills,
      screening_questions,
      auto_rejection_template,
      recruiter
    } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }
    if (!job_title) {
      throw new Error('job_title is required');
    }
    if (!description) {
      throw new Error('description is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/jobs?account_id=${account_id}`;

    const body = {
      job_title,
      company,
      description,
      location,
      employment_status,
      workplace
    };

    if (skills && skills.length > 0) body.skills = skills;
    if (screening_questions && screening_questions.length > 0) body.screening_questions = screening_questions;
    if (auto_rejection_template) body.auto_rejection_template = auto_rejection_template;
    if (recruiter) body.recruiter = recruiter;

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }

  /**
   * Publish a job draft to LinkedIn
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.job_id - Draft job ID (required)
   * @param {string} [params.mode='FREE'] - FREE, PROMOTED
   * @param {string} [params.service='CLASSIC'] - CLASSIC
   * @param {boolean} [params.hiring_photo_frame=false] - Show hiring frame on profile
   * @param {boolean} [params.bypass_email_verification=false] - Bypass email verification
   * @returns {Promise<Object>}
   */
  async publish(params) {
    const {
      account_id,
      job_id,
      mode = 'FREE',
      service = 'CLASSIC',
      hiring_photo_frame = false,
      bypass_email_verification = false
    } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }
    if (!job_id) {
      throw new Error('job_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/jobs/${job_id}/publish?account_id=${account_id}`;

    return this.provider.request({
      method: 'POST',
      url,
      data: { mode, service, hiring_photo_frame, bypass_email_verification },
      timeout: 30000
    });
  }

  /**
   * Delete a job posting
   * @param {Object} params
   * @param {string} params.account_id - Unipile account ID (required)
   * @param {string} params.job_id - Job ID (required)
   * @returns {Promise<Object>}
   */
  async delete(params) {
    const { account_id, job_id } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }
    if (!job_id) {
      throw new Error('job_id is required');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/jobs/${job_id}?account_id=${account_id}`;

    return this.provider.request({
      method: 'DELETE',
      url,
      timeout: 30000
    });
  }
}

module.exports = { UnipileJobsManager };
