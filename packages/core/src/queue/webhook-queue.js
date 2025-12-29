/**
 * Webhook Queue Helpers
 * Utilities for working with Bull queues for webhook processing
 *
 * Note: Bull and ioredis are optional peer dependencies.
 * These helpers are designed to work with Bull but can be adapted for other queue systems.
 */

const {
  generateJobId,
  getPriority,
  getJobOptions,
  createJobData
} = require('./job-helpers');

/**
 * Check if Bull is available
 * @returns {boolean}
 */
function isBullAvailable() {
  try {
    require('bull');
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a webhook queue with recommended settings
 *
 * @param {Object|string} redisConnection - Redis connection (URL string or ioredis options)
 * @param {Object} [options] - Queue options
 * @returns {Queue} Bull Queue instance
 */
function createWebhookQueue(redisConnection, options = {}) {
  if (!isBullAvailable()) {
    throw new Error('bull package is not installed. Run: npm install bull');
  }

  const Queue = require('bull');

  const defaultSettings = {
    lockDuration: 30000, // 30 seconds
    stalledInterval: 30000,
    maxStalledCount: 3,
    guardInterval: 5000,
    retryProcessDelay: 5000,
    drainDelay: 300
  };

  return new Queue(options.name || 'relay-webhooks', redisConnection, {
    settings: { ...defaultSettings, ...options.settings },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 }
    }
  });
}

/**
 * Add a webhook event to the queue
 *
 * @param {Queue} queue - Bull Queue instance
 * @param {NormalizedEvent} event - Normalized event to queue
 * @param {Object} [extra] - Extra data to include in job
 * @returns {Promise<Job>} Bull Job instance
 */
async function addWebhookJob(queue, event, extra = {}) {
  const jobData = createJobData(event, extra);
  const jobOptions = getJobOptions(event);

  const job = await queue.add(jobData, jobOptions);

  return job;
}

/**
 * Check if a webhook event has already been processed
 *
 * @param {Queue} queue - Bull Queue instance
 * @param {NormalizedEvent} event - Event to check
 * @returns {Promise<boolean>} True if already processed
 */
async function isWebhookProcessed(queue, event) {
  const jobId = generateJobId(event);
  const job = await queue.getJob(jobId);

  if (!job) return false;

  const state = await job.getState();
  return state === 'completed';
}

/**
 * Get webhook queue statistics
 *
 * @param {Queue} queue - Bull Queue instance
 * @returns {Promise<Object>} Queue statistics
 */
async function getWebhookQueueStats(queue) {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + completed + failed + delayed
  };
}

/**
 * Get failed webhook jobs for review
 *
 * @param {Queue} queue - Bull Queue instance
 * @param {number} [limit=50] - Max jobs to return
 * @returns {Promise<Array>} Failed jobs
 */
async function getFailedWebhookJobs(queue, limit = 50) {
  const failed = await queue.getFailed(0, limit - 1);

  return failed.map(job => ({
    id: job.id,
    eventType: job.data.eventType,
    event: job.data.event,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn
  }));
}

/**
 * Retry a failed webhook job
 *
 * @param {Queue} queue - Bull Queue instance
 * @param {string} jobId - Job ID to retry
 * @returns {Promise<Job>} Retried job
 */
async function retryWebhookJob(queue, jobId) {
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  await job.retry();
  return job;
}

/**
 * Create a webhook processor function
 *
 * @param {MessagingEventEmitter} emitter - Event emitter to dispatch to
 * @param {Object} [context={}] - Context to pass to handlers
 * @returns {Function} Processor function for queue.process()
 */
function createWebhookProcessor(emitter, context = {}) {
  return async (job) => {
    const { event } = job.data;

    // Reconstruct NormalizedEvent from serialized data
    const { NormalizedEvent } = require('../events/types');
    const normalizedEvent = new NormalizedEvent(event);

    // Emit to all handlers
    const results = await emitter.emit(normalizedEvent, {
      ...context,
      job,
      jobId: job.id
    });

    // Check if any handler failed
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Handler failures: ${failures.map(f => f.error).join(', ')}`);
    }

    return { handled: true, results };
  };
}

module.exports = {
  isBullAvailable,
  createWebhookQueue,
  addWebhookJob,
  isWebhookProcessed,
  getWebhookQueueStats,
  getFailedWebhookJobs,
  retryWebhookJob,
  createWebhookProcessor
};
