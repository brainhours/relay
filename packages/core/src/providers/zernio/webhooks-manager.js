/**
 * ZernioWebhooksManager — register / manage Zernio delivery webhooks.
 *
 * Zernio supports up to 10 webhooks per account. Each subscribes to one or more
 * events (post.*, message.*, account.*, comment.received, review.*, ad.*,
 * whatsapp.*). Configure a `secret` to enable HMAC-SHA256 signing of deliveries
 * (verify with `validateZernioSignature`).
 */

/** All webhook event names Zernio can deliver (for convenience / validation). */
const ZERNIO_WEBHOOK_EVENTS = Object.freeze([
  'post.scheduled', 'post.published', 'post.failed', 'post.partial', 'post.cancelled', 'post.recycled',
  'post.platform.published', 'post.platform.failed',
  'post.external.created', 'post.external.updated', 'post.external.deleted',
  'account.connected', 'account.disconnected', 'account.ads.initial_sync_completed',
  'message.received', 'message.sent', 'message.edited', 'message.deleted',
  'message.delivered', 'message.read', 'message.failed',
  'reaction.received', 'comment.received', 'review.new', 'review.updated', 'ad.status_changed',
  'whatsapp.template.status_updated',
  'whatsapp.number.activated', 'whatsapp.number.declined', 'whatsapp.number.action_required',
  'whatsapp.number.verification_required', 'whatsapp.number.suspended',
  'whatsapp.number.reactivated', 'whatsapp.number.released', 'whatsapp.number.kyc_submitted'
]);

class ZernioWebhooksManager {
  constructor(provider) {
    this.provider = provider;
  }

  /** List configured webhooks. */
  list() {
    return this.provider.request({ method: 'GET', path: '/webhooks/settings' });
  }

  /**
   * Create a webhook.
   * @param {Object} body - { name, url, events[], secret?, enabled?, headers? }
   */
  create(body) {
    return this.provider.request({ method: 'POST', path: '/webhooks/settings', data: body });
  }

  /**
   * Update a webhook.
   * @param {Object} body - { id, name?, url?, events?, secret?, enabled?, headers? }
   */
  update(body) {
    return this.provider.request({ method: 'PATCH', path: '/webhooks/settings', data: body });
  }

  /** Delete a webhook by id. */
  delete(id) {
    return this.provider.request({ method: 'DELETE', path: '/webhooks/settings', data: { id } });
  }

  /** Recent delivery logs. */
  logs(params = {}) {
    return this.provider.request({ method: 'GET', path: '/webhooks/logs', params });
  }

  /** Send a test delivery. */
  test(body = {}) {
    return this.provider.request({ method: 'POST', path: '/webhooks/test', data: body });
  }
}

module.exports = { ZernioWebhooksManager, ZERNIO_WEBHOOK_EVENTS };
