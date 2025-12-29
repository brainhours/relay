/**
 * Unipile Provider - Client for Unipile messaging API
 * Supports LinkedIn, WhatsApp, Instagram, Telegram, Messenger, Email
 *
 * @see https://developer.unipile.com/reference
 */

const axios = require('axios');
const FormData = require('form-data');
const { BaseProvider } = require('../base');

/**
 * Unipile Provider Configuration
 * @typedef {Object} UnipileConfig
 * @property {string} dsn - Unipile DSN (e.g., 'api1.unipile.com:13111')
 * @property {string} accessToken - Unipile API access token
 * @property {number} [timeout=15000] - Default request timeout in ms
 */

/**
 * Unipile Provider for multi-channel messaging
 */
class UnipileProvider extends BaseProvider {
  /**
   * @param {UnipileConfig} config
   */
  constructor(config) {
    super(config);
    this.name = 'unipile';
    this.dsn = config.dsn;
    this.accessToken = config.accessToken;
    this.timeout = config.timeout || 15000;
    this.initError = null;

    // Validate configuration
    if (!this.dsn || !this.accessToken) {
      this.initError = 'dsn and accessToken are required';
    }

    // Initialize sub-managers
    this.account = new UnipileAccountManager(this);
    this.users = new UnipileUserManager(this);
    this.connections = new UnipileConnectionManager(this);
    this.linkedin = new UnipileLinkedInManager(this);
    this.messaging = new UnipileMessagingManager(this);
  }

  /**
   * Check if the provider is properly initialized
   * @returns {boolean}
   */
  isInitialized() {
    return !this.initError && !!this.dsn && !!this.accessToken;
  }

  /**
   * Get initialization error if any
   * @returns {string|null}
   */
  getError() {
    return this.initError;
  }

  /**
   * Get base URL for API requests
   * @returns {string}
   */
  getBaseUrl() {
    return `https://${this.dsn}/api/v1`;
  }

  /**
   * Get default headers for API requests
   * @returns {Object}
   */
  getHeaders() {
    return {
      'X-API-KEY': this.accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Make an HTTP request to Unipile API
   * @param {Object} options - Axios request options
   * @returns {Promise<Object>}
   */
  async request(options) {
    const response = await axios({
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      },
      timeout: options.timeout || this.timeout
    });
    return response.data;
  }
}

/**
 * Account management for Unipile
 */
class UnipileAccountManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Generate a hosted authentication link for OAuth flow
   * @param {Object} options
   * @param {string[]} [options.providers] - Providers to allow (LINKEDIN, WHATSAPP, etc.)
   * @param {string} [options.successRedirectUrl] - URL to redirect on success
   * @param {string} [options.failureRedirectUrl] - URL to redirect on failure
   * @param {string} [options.notifyUrl] - Webhook URL for account events
   * @param {string} [options.name] - Optional account name/identifier
   * @returns {Promise<Object>}
   */
  async getHostedAuthLink(options = {}) {
    const url = `${this.provider.getBaseUrl()}/hosted/accounts/link`;

    // Expires in 30 minutes
    const expiresDate = new Date(Date.now() + 30 * 60 * 1000);

    const body = {
      type: 'create',
      api_url: `https://${this.provider.dsn}`,
      expiresOn: expiresDate.toISOString(),
      providers: options.providers || [
        'LINKEDIN', 'WHATSAPP', 'INSTAGRAM',
        'MESSENGER', 'TELEGRAM', 'TWITTER',
        'GOOGLE', 'OUTLOOK', 'MAIL'
      ],
      success_redirect_url: options.successRedirectUrl,
      failure_redirect_url: options.failureRedirectUrl
    };

    if (options.name) {
      body.name = options.name;
    }

    if (options.notifyUrl) {
      body.notify_url = options.notifyUrl;
    }

    return this.provider.request({
      method: 'POST',
      url,
      data: body
    });
  }

  /**
   * Connect a LinkedIn account directly with credentials
   * @param {Object} credentials
   * @returns {Promise<Object>}
   */
  async connectLinkedin(credentials) {
    const url = `${this.provider.getBaseUrl()}/accounts`;

    return this.provider.request({
      method: 'POST',
      url,
      data: {
        provider: 'LINKEDIN',
        type: 'LINKEDIN',
        credentials
      },
      timeout: 30000
    });
  }

  /**
   * Get account by ID
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async getById(accountId) {
    const url = `${this.provider.getBaseUrl()}/accounts/${accountId}`;
    return this.provider.request({ method: 'GET', url });
  }

  /**
   * Disconnect/delete an account
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async disconnect(accountId) {
    const url = `${this.provider.getBaseUrl()}/accounts/${accountId}`;
    return this.provider.request({ method: 'DELETE', url });
  }
}

/**
 * User operations for Unipile
 */
class UnipileUserManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Get the authenticated user's own profile
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async getOwnProfile(accountId) {
    const url = `${this.provider.getBaseUrl()}/users/me?account_id=${accountId}`;
    return this.provider.request({ method: 'GET', url });
  }

  /**
   * Get a user by ID
   * @param {string} accountId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getOne(accountId, userId) {
    const url = `${this.provider.getBaseUrl()}/users/${userId}?account_id=${accountId}`;
    return this.provider.request({ method: 'GET', url });
  }

  /**
   * Get full user profile with all LinkedIn sections
   * @param {string} accountId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getFullProfile(accountId, userId) {
    const url = `${this.provider.getBaseUrl()}/users/${userId}?account_id=${accountId}&linkedin_sections=*`;
    return this.provider.request({ method: 'GET', url, timeout: 30000 });
  }

  /**
   * Search for users
   * @param {Object} params
   * @param {string} params.account_id - Account ID (required)
   * @param {Object} [params...] - Other search parameters
   * @returns {Promise<Object>}
   */
  async search(params) {
    const { account_id, ...bodyParams } = params;
    const url = `${this.provider.getBaseUrl()}/users/search?account_id=${account_id}`;

    return this.provider.request({
      method: 'POST',
      url,
      data: bodyParams,
      timeout: 30000
    });
  }

  /**
   * Send a connection/invite request
   * @param {Object} params
   * @param {string} params.account_id
   * @param {string} params.user_id - Provider ID of the user
   * @param {string} [params.message] - Optional message (max 300 chars)
   * @returns {Promise<Object>}
   */
  async sendConnectionRequest(params) {
    const { account_id, user_id, message } = params;
    const url = `${this.provider.getBaseUrl()}/users/invite`;

    const body = {
      provider_id: user_id,
      account_id
    };

    if (message) {
      body.message = message.substring(0, 300);
    }

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 30000
    });
  }
}

/**
 * Connection management (1st degree connections)
 */
class UnipileConnectionManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Search 1st degree connections
   * @param {Object} params
   * @param {string} params.account_id - Account ID (required)
   * @param {number} [params.limit=100] - Max results
   * @param {string} [params.cursor] - Pagination cursor
   * @param {string} [params.keywords] - Search keywords
   * @param {string|string[]} [params.job_title] - Job title filter
   * @param {string|string[]} [params.industry] - Industry filter
   * @param {string} [params.location] - Location filter
   * @returns {Promise<Object>}
   */
  async search(params) {
    const { account_id, limit = 100, cursor, keywords, job_title, industry, location } = params;

    if (!account_id) {
      throw new Error('account_id is required for connections search');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    const body = {
      api: 'classic',
      category: 'people',
      network_distance: [1], // 1st degree only
      limit
    };

    if (keywords) body.keywords = keywords;
    if (job_title) body.job_title = Array.isArray(job_title) ? job_title : [job_title];
    if (industry) body.industry = Array.isArray(industry) ? industry : [industry];
    if (location) body.location = location;
    if (cursor) body.cursor = cursor;

    return this.provider.request({
      method: 'POST',
      url,
      data: body,
      timeout: 60000
    });
  }
}

/**
 * LinkedIn-specific operations
 */
class UnipileLinkedInManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Advanced LinkedIn search
   * @param {Object} params
   * @param {string} params.account_id - Account ID (required)
   * @param {Object} [params...] - Search parameters (api, category, keywords, etc.)
   * @returns {Promise<Object>}
   */
  async search(params) {
    const { account_id, ...bodyParams } = params;

    if (!account_id) {
      throw new Error('account_id is required for LinkedIn search');
    }

    const url = `${this.provider.getBaseUrl()}/linkedin/search?account_id=${account_id}`;

    // Clean empty parameters
    const cleanBody = {};
    Object.entries(bodyParams).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          cleanBody[key] = value;
        } else if (!Array.isArray(value)) {
          cleanBody[key] = value;
        }
      }
    });

    return this.provider.request({
      method: 'POST',
      url,
      data: cleanBody,
      timeout: 30000
    });
  }
}

/**
 * Messaging operations
 */
class UnipileMessagingManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Send a message to a user (creates new chat if needed)
   * @param {Object} params
   * @param {string} params.account_id
   * @param {string} params.user_id - User/attendee ID
   * @param {string} params.text - Message content
   * @returns {Promise<Object>}
   */
  async send(params) {
    const { account_id, user_id, text } = params;

    if (!account_id || !user_id || !text) {
      throw new Error('account_id, user_id, and text are required');
    }

    const url = `${this.provider.getBaseUrl()}/messaging/send?account_id=${account_id}`;

    return this.provider.request({
      method: 'POST',
      url,
      data: {
        attendees_ids: [user_id],
        text
      }
    });
  }

  /**
   * Get messages from a chat
   * @param {Object} params
   * @param {string} params.account_id
   * @param {string} params.chat_id
   * @param {number} [params.limit=50]
   * @param {string} [params.before_id] - For pagination
   * @returns {Promise<Object>}
   */
  async getMessages(params) {
    const { account_id, chat_id, limit = 50, before_id } = params;

    if (!account_id || !chat_id) {
      throw new Error('account_id and chat_id are required');
    }

    let url = `${this.provider.getBaseUrl()}/chats/${chat_id}/messages?account_id=${account_id}&limit=${limit}`;

    if (before_id) {
      url += `&before_id=${before_id}`;
    }

    return this.provider.request({ method: 'GET', url });
  }

  /**
   * Send message to an existing chat
   * @param {Object} params
   * @param {string} params.account_id
   * @param {string} params.chat_id
   * @param {string} params.text
   * @returns {Promise<Object>}
   */
  async sendMessage(params) {
    const { account_id, chat_id, text } = params;

    if (!account_id || !chat_id || !text) {
      throw new Error('account_id, chat_id, and text are required');
    }

    const url = `${this.provider.getBaseUrl()}/chats/${chat_id}/messages?account_id=${account_id}`;

    return this.provider.request({
      method: 'POST',
      url,
      data: { text }
    });
  }

  /**
   * Send message with attachments
   * @param {Object} params
   * @param {string} params.account_id
   * @param {string} params.chat_id
   * @param {string} [params.text]
   * @param {Array<{filename: string, buffer: Buffer, mimetype: string}>} params.attachments
   * @returns {Promise<Object>}
   */
  async sendMessageWithAttachment(params) {
    const { account_id, chat_id, text, attachments } = params;

    if (!account_id || !chat_id) {
      throw new Error('account_id and chat_id are required');
    }

    if (!attachments || attachments.length === 0) {
      throw new Error('At least one attachment is required');
    }

    const url = `${this.provider.getBaseUrl()}/chats/${chat_id}/messages?account_id=${account_id}`;

    const formData = new FormData();

    if (text && text.trim()) {
      formData.append('text', text.trim());
    }

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
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024
    });

    return response.data;
  }

  /**
   * Get attachment from a message
   * @param {Object} params
   * @param {string} params.account_id
   * @param {string} params.message_id
   * @param {string} params.attachment_id
   * @returns {Promise<{data: Buffer, contentType: string, contentDisposition: string}>}
   */
  async getAttachment(params) {
    const { account_id, message_id, attachment_id } = params;

    if (!account_id || !message_id || !attachment_id) {
      throw new Error('account_id, message_id, and attachment_id are required');
    }

    const url = `${this.provider.getBaseUrl()}/messages/${message_id}/attachments/${attachment_id}?account_id=${account_id}`;

    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': this.provider.accessToken,
        'Accept': '*/*'
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    return {
      data: response.data,
      contentType: response.headers['content-type'],
      contentDisposition: response.headers['content-disposition']
    };
  }

  /**
   * Get all chats
   * @param {Object} params
   * @param {string} params.account_id
   * @param {number} [params.limit=50]
   * @param {string} [params.cursor]
   * @returns {Promise<Object>}
   */
  async getChats(params) {
    const { account_id, limit = 50, cursor } = params;

    if (!account_id) {
      throw new Error('account_id is required');
    }

    let url = `${this.provider.getBaseUrl()}/chats?account_id=${account_id}&limit=${limit}`;

    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    return this.provider.request({ method: 'GET', url });
  }

  /**
   * Get single chat details
   * @param {Object} params
   * @param {string} params.account_id
   * @param {string} params.chat_id
   * @returns {Promise<Object>}
   */
  async getChat(params) {
    const { account_id, chat_id } = params;

    if (!account_id || !chat_id) {
      throw new Error('account_id and chat_id are required');
    }

    const url = `${this.provider.getBaseUrl()}/chats/${chat_id}?account_id=${account_id}`;
    return this.provider.request({ method: 'GET', url });
  }

  /**
   * Get attendee details by ID
   * @param {string} attendeeId
   * @returns {Promise<Object|null>}
   */
  async getAttendeeById(attendeeId) {
    if (!attendeeId) {
      throw new Error('attendeeId is required');
    }

    const url = `${this.provider.getBaseUrl()}/chat_attendees/${attendeeId}`;

    try {
      return await this.provider.request({ method: 'GET', url });
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get attendee profile picture
   * @param {string} attendeeId
   * @returns {Promise<{data: Buffer, contentType: string}|null>}
   */
  async getAttendeePicture(attendeeId) {
    if (!attendeeId) {
      throw new Error('attendeeId is required');
    }

    const url = `${this.provider.getBaseUrl()}/chat_attendees/${attendeeId}/picture`;

    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': this.provider.accessToken,
        'Accept': '*/*'
      },
      responseType: 'arraybuffer',
      timeout: 15000,
      validateStatus: (status) => status < 500
    });

    if (response.status === 404 || response.status === 204) {
      return null;
    }

    if (response.status !== 200) {
      return null;
    }

    return {
      data: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'image/jpeg'
    };
  }

  /**
   * Get own profile from chats (for WhatsApp, Instagram, etc.)
   * @param {string} accountId
   * @returns {Promise<Object|null>}
   */
  async getOwnProfileFromChats(accountId) {
    // Get account info first
    const accountData = await this.provider.account.getById(accountId);
    const connectionParams = accountData?.connection_params?.im || {};
    const ownIdentifier = connectionParams.phone_number || connectionParams.phone || accountData.name;

    // Get chats to find own attendee
    const chatsData = await this.getChats({ account_id: accountId, limit: 10 });
    const chats = chatsData.items || chatsData || [];

    if (chats.length === 0) {
      return null;
    }

    // Look for own attendee in chats
    for (const chat of chats) {
      const attendees = chat.attendees || [];

      for (const attendee of attendees) {
        const attendeeId = attendee.id || attendee.identifier || '';
        const attendeeName = attendee.name || attendee.display_name || '';
        const attendeePhone = attendee.phone_number || attendee.identifier || '';

        if (attendee.is_self === true ||
            attendeeId.includes(ownIdentifier) ||
            attendeePhone.includes(ownIdentifier) ||
            (ownIdentifier && attendeeName === ownIdentifier)) {

          return {
            name: attendee.name || attendee.display_name || attendee.pushname,
            profile_picture: attendee.profile_picture || attendee.profile_picture_url || attendee.picture_url,
            phone_number: attendee.phone_number || attendee.identifier || ownIdentifier,
            id: attendee.id,
            is_self: true
          };
        }
      }
    }

    return null;
  }
}

module.exports = { UnipileProvider };
