/**
 * Base provider interface for all messaging providers
 * All providers (Unipile, Twilio, Uazapi) should extend this class
 */
class BaseProvider {
  /**
   * @param {Object} config - Provider configuration
   */
  constructor(config) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly');
    }
    this.config = config;
    this.name = 'base';
  }

  /**
   * Check if the provider is properly initialized
   * @returns {boolean}
   */
  isInitialized() {
    throw new Error('isInitialized() must be implemented');
  }

  /**
   * Get initialization error if any
   * @returns {string|null}
   */
  getError() {
    throw new Error('getError() must be implemented');
  }
}

/**
 * Base account management interface
 */
class BaseAccountManager {
  /**
   * Get a hosted authentication link for OAuth flow
   * @param {Object} options - Options for the auth link
   * @returns {Promise<Object>}
   */
  async getHostedAuthLink(options) {
    throw new Error('getHostedAuthLink() must be implemented');
  }

  /**
   * Get account by ID
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async getById(accountId) {
    throw new Error('getById() must be implemented');
  }

  /**
   * Disconnect/delete an account
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async disconnect(accountId) {
    throw new Error('disconnect() must be implemented');
  }
}

/**
 * Base user operations interface
 */
class BaseUserManager {
  /**
   * Get the authenticated user's own profile
   * @param {string} accountId
   * @returns {Promise<Object>}
   */
  async getOwnProfile(accountId) {
    throw new Error('getOwnProfile() must be implemented');
  }

  /**
   * Get a user by ID
   * @param {string} accountId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getOne(accountId, userId) {
    throw new Error('getOne() must be implemented');
  }

  /**
   * Search for users
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>}
   */
  async search(params) {
    throw new Error('search() must be implemented');
  }
}

/**
 * Base messaging interface
 */
class BaseMessagingManager {
  /**
   * Send a message to a user
   * @param {Object} params - Message parameters
   * @returns {Promise<Object>}
   */
  async send(params) {
    throw new Error('send() must be implemented');
  }

  /**
   * Get messages from a chat
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>}
   */
  async getMessages(params) {
    throw new Error('getMessages() must be implemented');
  }

  /**
   * Get all chats
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>}
   */
  async getChats(params) {
    throw new Error('getChats() must be implemented');
  }

  /**
   * Send a message to an existing chat
   * @param {Object} params - Message parameters
   * @returns {Promise<Object>}
   */
  async sendMessage(params) {
    throw new Error('sendMessage() must be implemented');
  }
}

module.exports = {
  BaseProvider,
  BaseAccountManager,
  BaseUserManager,
  BaseMessagingManager
};
