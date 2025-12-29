/**
 * Queue module - Bull queue helpers for webhook processing
 */

const {
  PRIORITY_LEVELS,
  EVENT_PRIORITIES,
  generateJobId,
  generateJobIdFromPayload,
  getPriority,
  getJobOptions,
  createJobData
} = require('./job-helpers');

const {
  isBullAvailable,
  createWebhookQueue,
  addWebhookJob,
  isWebhookProcessed,
  getWebhookQueueStats,
  getFailedWebhookJobs,
  retryWebhookJob,
  createWebhookProcessor
} = require('./webhook-queue');

module.exports = {
  // Job helpers
  PRIORITY_LEVELS,
  EVENT_PRIORITIES,
  generateJobId,
  generateJobIdFromPayload,
  getPriority,
  getJobOptions,
  createJobData,

  // Queue operations
  isBullAvailable,
  createWebhookQueue,
  addWebhookJob,
  isWebhookProcessed,
  getWebhookQueueStats,
  getFailedWebhookJobs,
  retryWebhookJob,
  createWebhookProcessor
};
