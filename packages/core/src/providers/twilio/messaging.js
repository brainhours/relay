/**
 * Twilio messaging manager.
 *
 * Wraps the Message resource (`/Accounts/{Sid}/Messages.json`). All sends POST
 * `application/x-www-form-urlencoded`; reads are GET with query filters.
 *
 * Coverage:
 *   - send             — generic (any channel; the building block for the rest)
 *   - sendSms          — plain SMS
 *   - sendMms          — SMS with media (mediaUrl)
 *   - sendWhatsApp     — WhatsApp free-form OR Content template (within 24h window
 *                        you can send free-form; outside it you MUST pass a
 *                        contentSid of an approved template)
 *   - sendContentTemplate — Content API template (WhatsApp/SMS/RCS) via contentSid
 *   - get / list       — fetch one / page through the message log
 *   - redact           — overwrite Body with '' (compliance) — keeps the record
 *   - delete           — delete the message record entirely
 *
 * Addressing:
 *   SMS/MMS  -> `+E.164`              (e.g. '+5511999999999')
 *   WhatsApp -> `whatsapp:+E.164`     (the manager adds the prefix for you when
 *                                      you pass channel/sendWhatsApp)
 *
 * `from` vs `messagingServiceSid`: pass exactly one. A Messaging Service lets
 * Twilio pick the best sender from a pool (sender pool, sticky sender, etc.).
 */

const { BaseMessagingManager } = require('../base');
const { toChannelAddress } = require('./addresses');

/** @internal — strip undefined keys to keep the form tidy. */
function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class TwilioMessagingManager extends BaseMessagingManager {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  /**
   * Generic send. Builds the Message form and POSTs it. Every other send helper
   * funnels through here.
   *
   * Provide either `from` OR `messagingServiceSid` (not both). Provide either
   * `body`, `mediaUrl`, or `contentSid` (at least one).
   *
   * @param {Object} params
   * @param {string} [params.accountSid]              - per-call override
   * @param {string} [params.authToken]               - per-call override
   * @param {string} [params.apiKeySid]               - per-call override
   * @param {string} [params.apiKeySecret]            - per-call override
   * @param {string} params.to                        - destination (E.164; prefix added per channel)
   * @param {string} [params.from]                    - your Twilio sender (E.164; prefix added per channel)
   * @param {string} [params.messagingServiceSid]     - alternative to `from` (MG…)
   * @param {string} [params.body]                    - text body
   * @param {string|string[]} [params.mediaUrl]       - one or more public media URLs (MMS / WhatsApp media)
   * @param {string} [params.contentSid]              - Content API template (HX…)
   * @param {Object|string} [params.contentVariables] - template variables (object or JSON string)
   * @param {'sms'|'mms'|'whatsapp'|'messenger'} [params.channel='sms'] - controls address prefixing
   * @param {string} [params.statusCallback]          - URL Twilio POSTs delivery status to
   * @param {string} [params.sendAt]                  - ISO-8601; requires scheduleType='fixed' + a Messaging Service
   * @param {'fixed'} [params.scheduleType]
   * @param {number} [params.validityPeriod]          - seconds (1–14400) the message stays valid
   * @param {boolean} [params.smartEncoded]
   * @param {boolean} [params.shortenUrls]            - Messaging Service link shortening
   * @param {string|string[]} [params.persistentAction] - WhatsApp quick actions (e.g. geo)
   * @param {string} [params.riskCheck]               - 'enable' | 'disable'
   * @returns {Promise<Object>} the Twilio Message resource (sid, status, ...)
   */
  async send({
    accountSid,
    authToken,
    apiKeySid,
    apiKeySecret,
    to,
    from,
    messagingServiceSid,
    body,
    mediaUrl,
    contentSid,
    contentVariables,
    channel = 'sms',
    statusCallback,
    sendAt,
    scheduleType,
    validityPeriod,
    smartEncoded,
    shortenUrls,
    persistentAction,
    riskCheck
  }) {
    if (!to) throw new Error('twilio.send: `to` is required');
    if (!from && !messagingServiceSid) {
      throw new Error('twilio.send: either `from` or `messagingServiceSid` is required');
    }
    if (body === undefined && mediaUrl === undefined && contentSid === undefined) {
      throw new Error('twilio.send: one of `body`, `mediaUrl` or `contentSid` is required');
    }

    const form = omitUndef({
      To: toChannelAddress(to, channel),
      From: from ? toChannelAddress(from, channel) : undefined,
      MessagingServiceSid: messagingServiceSid,
      Body: body,
      MediaUrl: mediaUrl,
      ContentSid: contentSid,
      ContentVariables:
        contentVariables === undefined
          ? undefined
          : typeof contentVariables === 'string'
            ? contentVariables
            : JSON.stringify(contentVariables),
      StatusCallback: statusCallback,
      SendAt: sendAt,
      ScheduleType: scheduleType,
      ValidityPeriod: validityPeriod,
      SmartEncoded: smartEncoded,
      ShortenUrls: shortenUrls,
      PersistentAction: persistentAction,
      RiskCheck: riskCheck
    });

    return this.provider.request({
      method: 'POST',
      path: '/Messages.json',
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret,
      form
    });
  }

  /**
   * Send a plain SMS.
   * @param {Object} params - see `send`; `channel` is forced to 'sms'.
   */
  async sendSms(params) {
    return this.send({ ...params, channel: 'sms' });
  }

  /**
   * Send an MMS (SMS with media). Requires `mediaUrl`.
   * @param {Object} params - see `send`; `channel` is forced to 'mms'.
   */
  async sendMms(params) {
    if (params.mediaUrl === undefined) {
      throw new Error('twilio.sendMms: `mediaUrl` is required');
    }
    return this.send({ ...params, channel: 'mms' });
  }

  /**
   * Send a WhatsApp message. Inside the 24h customer-service window you may send
   * free-form (`body`/`mediaUrl`); outside it you MUST pass `contentSid` of an
   * approved WhatsApp template (Twilio Content API). The manager adds the
   * `whatsapp:` prefix to `to`/`from` for you.
   *
   * @param {Object} params - see `send`; `channel` is forced to 'whatsapp'.
   */
  async sendWhatsApp(params) {
    return this.send({ ...params, channel: 'whatsapp' });
  }

  /**
   * Send a Content API template (works for WhatsApp, SMS, RCS, ...). Equivalent
   * to `send` with a `contentSid` — provided as a named method for clarity.
   *
   * @param {Object} params
   * @param {string} params.to
   * @param {string} params.contentSid                - HX… template id
   * @param {Object|string} [params.contentVariables]
   * @param {string} [params.from]
   * @param {string} [params.messagingServiceSid]
   * @param {'sms'|'whatsapp'} [params.channel='whatsapp']
   */
  async sendContentTemplate({ channel = 'whatsapp', ...params }) {
    if (!params.contentSid) {
      throw new Error('twilio.sendContentTemplate: `contentSid` is required');
    }
    return this.send({ ...params, channel });
  }

  /**
   * Fetch a single message by SID.
   * @param {Object} params
   * @param {string} params.messageSid                - SM… / MM… / WA… SID
   * @param {string} [params.accountSid]
   */
  async get({ messageSid, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!messageSid) throw new Error('twilio.get: `messageSid` is required');
    return this.provider.request({
      method: 'GET',
      path: `/Messages/${messageSid}.json`,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * List messages (one page). Twilio paginates with `next_page_uri`; pass it to
   * `listNextPage` (or use `pageSize`/`page`).
   *
   * @param {Object} [params]
   * @param {string} [params.to]                      - filter by recipient
   * @param {string} [params.from]                    - filter by sender
   * @param {string} [params.dateSent]                - YYYY-MM-DD (also DateSent<= / DateSent>= via dateSentBefore/After)
   * @param {string} [params.dateSentBefore]
   * @param {string} [params.dateSentAfter]
   * @param {number} [params.pageSize=50]
   * @returns {Promise<{ messages: any[], next_page_uri?: string, ... }>}
   */
  async list({
    to,
    from,
    dateSent,
    dateSentBefore,
    dateSentAfter,
    pageSize = 50,
    accountSid,
    authToken,
    apiKeySid,
    apiKeySecret
  } = {}) {
    const params = omitUndef({
      To: to,
      From: from,
      DateSent: dateSent,
      'DateSent<': dateSentBefore,
      'DateSent>': dateSentAfter,
      PageSize: pageSize
    });
    return this.provider.request({
      method: 'GET',
      path: '/Messages.json',
      params,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * Follow a `next_page_uri` returned by `list`. Twilio gives a path relative to
   * `api.twilio.com`, so we treat it as an absolute URL on the same host.
   * @param {Object} params
   * @param {string} params.nextPageUri               - value from list().next_page_uri
   */
  async listNextPage({ nextPageUri, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!nextPageUri) throw new Error('twilio.listNextPage: `nextPageUri` is required');
    const absoluteUrl = /^https?:\/\//i.test(nextPageUri)
      ? nextPageUri
      : `${this.provider.baseUrl}${nextPageUri}`;
    return this.provider.request({
      method: 'GET',
      absoluteUrl,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * Redact a message body (set Body to ''). Keeps the message record but
   * removes the content — useful for PII/compliance. Only works while the
   * message is still in Twilio's retention window.
   * @param {Object} params
   * @param {string} params.messageSid
   */
  async redact({ messageSid, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!messageSid) throw new Error('twilio.redact: `messageSid` is required');
    return this.provider.request({
      method: 'POST',
      path: `/Messages/${messageSid}.json`,
      form: { Body: '' },
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  /**
   * Delete a message record entirely.
   * @param {Object} params
   * @param {string} params.messageSid
   */
  async delete({ messageSid, accountSid, authToken, apiKeySid, apiKeySecret }) {
    if (!messageSid) throw new Error('twilio.delete: `messageSid` is required');
    return this.provider.request({
      method: 'DELETE',
      path: `/Messages/${messageSid}.json`,
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret
    });
  }

  // ---- BaseMessagingManager contract ----

  /** Generic send (SMS by default). */
  async sendMessage(params) {
    return this.send(params);
  }
}

module.exports = { TwilioMessagingManager };
