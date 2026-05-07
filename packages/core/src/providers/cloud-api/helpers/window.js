/**
 * Cloud API 24-hour customer-service window helper.
 *
 * Free-form messages are only allowed within 24 hours of the most recent
 * INBOUND message from the contact. Outside the window, only pre-approved
 * templates can be sent. Apps usually store `lastInboundAt` per conversation
 * and call this helper before deciding whether to allow free-form send.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#service-window
 */

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Date|string|number|null|undefined} lastInboundAt
 * @param {number} [windowMs=86400000]   - default 24h
 * @param {number} [now=Date.now()]      - injectable for tests
 * @returns {boolean} true if free-form send is allowed
 */
function isInWindow(lastInboundAt, windowMs = DEFAULT_WINDOW_MS, now = Date.now()) {
  if (!lastInboundAt) return false;
  const then = lastInboundAt instanceof Date
    ? lastInboundAt.getTime()
    : new Date(lastInboundAt).getTime();
  if (!Number.isFinite(then)) return false;
  return now - then < windowMs;
}

module.exports = { isInWindow, DEFAULT_WINDOW_MS };
