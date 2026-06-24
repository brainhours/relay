/**
 * Minimal TwiML builders (zero-dep).
 *
 * Twilio webhooks may respond with TwiML — an XML document instructing Twilio
 * what to do next. For messaging the useful verbs are `<Message>` (reply) and
 * `<Redirect>` (hand off to another URL). Most apps that dispatch replies via
 * the REST API instead just answer with an EMPTY `<Response/>` so Twilio does
 * nothing — `emptyMessagingResponse()` covers that.
 *
 * These builders escape XML for you. They intentionally cover the messaging
 * subset only; for Voice TwiML use the official `twilio` SDK.
 *
 * @example
 *   res.type('text/xml').send(messagingResponse('Thanks, we got your message!'));
 *   res.type('text/xml').send(messagingResponse([
 *     { body: 'First line' },
 *     { body: 'See the attachment', mediaUrl: 'https://example.com/a.jpg' }
 *   ]));
 *   res.type('text/xml').send(emptyMessagingResponse());
 *
 * @see https://www.twilio.com/docs/messaging/twiml
 */

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

/** Escape the five XML special characters. @private */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a `<Response>` containing one or more `<Message>` verbs.
 *
 * @param {string|Object|Array<string|Object>} messages
 *   - string                          => one text message
 *   - { body, to?, from?, mediaUrl? } => one message (mediaUrl: string | string[])
 *   - array of the above              => multiple messages
 * @returns {string} TwiML XML string
 */
function messagingResponse(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  const body = list
    .map((m) => {
      const msg = typeof m === 'string' ? { body: m } : m || {};
      const attrs = [];
      if (msg.to) attrs.push(` to="${escapeXml(msg.to)}"`);
      if (msg.from) attrs.push(` from="${escapeXml(msg.from)}"`);
      const inner = [];
      if (msg.body !== undefined && msg.body !== null && msg.body !== '') {
        inner.push(`<Body>${escapeXml(msg.body)}</Body>`);
      }
      const media = msg.mediaUrl == null ? [] : Array.isArray(msg.mediaUrl) ? msg.mediaUrl : [msg.mediaUrl];
      for (const u of media) inner.push(`<Media>${escapeXml(u)}</Media>`);
      // If only a plain body and no media, the compact form `<Message>text</Message>`
      // is valid and what Twilio's own examples emit.
      if (inner.length === 1 && inner[0].startsWith('<Body>') && attrs.length === 0) {
        return `<Message>${escapeXml(msg.body)}</Message>`;
      }
      return `<Message${attrs.join('')}>${inner.join('')}</Message>`;
    })
    .join('');
  return `${XML_HEADER}<Response>${body}</Response>`;
}

/**
 * Build an empty `<Response/>` — tells Twilio to take no action. Use this when
 * your app replies asynchronously via the REST API.
 * @returns {string}
 */
function emptyMessagingResponse() {
  return `${XML_HEADER}<Response></Response>`;
}

/**
 * Build a `<Response>` with a single `<Redirect>` verb (hand the call/message
 * off to another TwiML URL).
 * @param {string} url
 * @param {'GET'|'POST'} [method='POST']
 * @returns {string}
 */
function redirectResponse(url, method = 'POST') {
  return `${XML_HEADER}<Response><Redirect method="${escapeXml(method)}">${escapeXml(url)}</Redirect></Response>`;
}

module.exports = {
  messagingResponse,
  emptyMessagingResponse,
  redirectResponse,
  escapeXml
};
