/**
 * Event emitter for handling normalized events
 * Applications register handlers for specific event types
 */

/**
 * MessagingEventEmitter - Register and emit normalized events
 */
class MessagingEventEmitter {
  constructor() {
    this.handlers = new Map();
    this.middlewares = [];
  }

  /**
   * Register a handler for an event type
   * @param {string} eventType - Event type (from EventTypes)
   * @param {Function} handler - async (event, context) => result
   * @returns {Function} Unsubscribe function
   */
  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Register a handler for all events
   * @param {Function} handler - async (event, context) => result
   * @returns {Function} Unsubscribe function
   */
  onAll(handler) {
    return this.on('*', handler);
  }

  /**
   * Register middleware that runs before all handlers
   * @param {Function} middleware - async (event, context, next) => result
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Emit an event to all registered handlers
   * @param {NormalizedEvent} event - The normalized event
   * @param {Object} [context={}] - Application-specific context
   * @returns {Promise<Array>} Results from all handlers
   */
  async emit(event, context = {}) {
    const results = [];

    // Run middlewares first
    let shouldContinue = true;
    for (const middleware of this.middlewares) {
      try {
        const next = () => { shouldContinue = true; };
        shouldContinue = false;
        await middleware(event, context, next);
        if (!shouldContinue) {
          return results; // Middleware stopped propagation
        }
      } catch (error) {
        console.error('Middleware error:', error);
      }
    }

    // Get handlers for this specific event type
    const typeHandlers = this.handlers.get(event.type) || [];

    // Get wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || [];

    // Combine and execute all handlers
    const allHandlers = [...typeHandlers, ...wildcardHandlers];

    for (const handler of allHandlers) {
      try {
        const result = await handler(event, context);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Check if there are handlers for an event type
   * @param {string} eventType
   * @returns {boolean}
   */
  hasHandlers(eventType) {
    const typeHandlers = this.handlers.get(eventType) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    return typeHandlers.length > 0 || wildcardHandlers.length > 0;
  }

  /**
   * Remove all handlers for an event type
   * @param {string} eventType
   */
  off(eventType) {
    this.handlers.delete(eventType);
  }

  /**
   * Remove all handlers
   */
  removeAllListeners() {
    this.handlers.clear();
    this.middlewares = [];
  }
}

/**
 * Create a singleton emitter for the application
 */
let defaultEmitter = null;

function getDefaultEmitter() {
  if (!defaultEmitter) {
    defaultEmitter = new MessagingEventEmitter();
  }
  return defaultEmitter;
}

module.exports = {
  MessagingEventEmitter,
  getDefaultEmitter
};
