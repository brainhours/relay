/**
 * Queue job helper functions
 * Utilities for generating job IDs and managing priorities
 */

const { EventTypes } = require('../events/types');

/**
 * Priority levels for webhook jobs
 * Lower number = higher priority
 */
const PRIORITY_LEVELS = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 5,
  LOW: 7,
  BACKGROUND: 10
};

/**
 * Default priorities for event types
 */
const EVENT_PRIORITIES = {
  // Critical - require immediate attention
  [EventTypes.MESSAGE_RECEIVED]: PRIORITY_LEVELS.CRITICAL,

  // High - important updates
  [EventTypes.RELATION_CREATED]: PRIORITY_LEVELS.HIGH,
  [EventTypes.ACCOUNT_CONNECTED]: PRIORITY_LEVELS.HIGH,
  [EventTypes.ACCOUNT_DISCONNECTED]: PRIORITY_LEVELS.HIGH,

  // Medium - status updates
  [EventTypes.MESSAGE_SENT]: PRIORITY_LEVELS.MEDIUM,
  [EventTypes.MESSAGE_EDITED]: PRIORITY_LEVELS.MEDIUM,
  [EventTypes.ACCOUNT_STATUS_CHANGED]: PRIORITY_LEVELS.MEDIUM,

  // Low - acknowledgments
  [EventTypes.MESSAGE_READ]: PRIORITY_LEVELS.LOW,
  [EventTypes.MESSAGE_DELIVERED]: PRIORITY_LEVELS.LOW,
  [EventTypes.MESSAGE_DELETED]: PRIORITY_LEVELS.LOW,

  // Background
  [EventTypes.MESSAGE_REACTION]: PRIORITY_LEVELS.BACKGROUND
};

/**
 * Generate a unique job ID for webhook deduplication
 *
 * @param {NormalizedEvent} event - Normalized event
 * @returns {string} Unique job ID
 */
function generateJobId(event) {
  const identifier =
    event.messageId ||
    event.chatId ||
    event.metadata?.relation?.userId ||
    `${Date.now()}`;

  return `webhook:${event.provider}:${event.type}:${identifier}`;
}

/**
 * Generate a job ID from raw event type and payload
 *
 * @param {string} eventType - Event type
 * @param {Object} payload - Raw payload
 * @returns {string} Unique job ID
 */
function generateJobIdFromPayload(eventType, payload) {
  const identifier =
    payload.message_id ||
    payload.messageId ||
    payload.chat_id ||
    payload.chatId ||
    payload.id ||
    `${Date.now()}`;

  return `webhook:${eventType}:${identifier}`;
}

/**
 * Get job priority based on event type
 *
 * @param {string} eventType - Event type (from EventTypes)
 * @returns {number} Priority level (lower = higher priority)
 */
function getPriority(eventType) {
  return EVENT_PRIORITIES[eventType] || PRIORITY_LEVELS.MEDIUM;
}

/**
 * Get default Bull job options for a webhook event
 *
 * @param {NormalizedEvent} event - Normalized event
 * @param {Object} [options] - Additional options
 * @returns {Object} Bull job options
 */
function getJobOptions(event, options = {}) {
  return {
    jobId: generateJobId(event),
    priority: getPriority(event.type),
    attempts: options.attempts || 3,
    backoff: options.backoff || {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: options.removeOnComplete !== undefined
      ? options.removeOnComplete
      : { age: 24 * 3600 }, // Keep completed jobs for 24 hours
    removeOnFail: options.removeOnFail !== undefined
      ? options.removeOnFail
      : { age: 7 * 24 * 3600 } // Keep failed jobs for 7 days
  };
}

/**
 * Create job data payload
 *
 * @param {NormalizedEvent} event - Normalized event
 * @param {Object} [extra] - Extra data to include
 * @returns {Object} Job data
 */
function createJobData(event, extra = {}) {
  return {
    event: event.toJSON(),
    eventType: event.type,
    provider: event.provider,
    receivedAt: new Date().toISOString(),
    ...extra
  };
}

module.exports = {
  PRIORITY_LEVELS,
  EVENT_PRIORITIES,
  generateJobId,
  generateJobIdFromPayload,
  getPriority,
  getJobOptions,
  createJobData
};
