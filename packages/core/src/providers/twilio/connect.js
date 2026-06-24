/**
 * Twilio Connect — OAuth-style hosted authorization.
 *
 * Lets an app (an ISV / platform) onboard a customer's Twilio account WITHOUT
 * the customer ever pasting an Account SID / Auth Token. The customer clicks a
 * "Connect" button, is redirected to a Twilio-hosted screen, logs into their
 * OWN Twilio account and authorizes your Connect App. Twilio then redirects back
 * to the Authorize URL you configured on the Connect App (in the Console) with
 * the connected `AccountSid` on the query string. Twilio bills that customer
 * directly for their usage.
 *
 * This module ships ONLY the thin, zero-dependency, network-free pieces of the
 * flow — the redirect URL builder and the callback parsers. The OAuth dance
 * itself (the redirect route, CSRF `state`, the callback route, persisting the
 * `AccountSid`) is inherently app-side and stays in the consuming app, exactly
 * like Unipile's hosted-auth link is paired with app-owned routes.
 *
 * AUTHENTICATING API CALLS AFTER CONNECT
 * ──────────────────────────────────────
 * Connect does NOT give you the customer's Auth Token. You make API calls on
 * their behalf with the connected `AccountSid` (in the URL path + Basic-auth
 * username) and YOUR Connect App's master Auth Token as the Basic-auth password.
 * `TwilioProvider` already supports this — pass the connected `accountSid`
 * per-call while the provider holds your master `authToken`:
 *
 *   const twilio = new TwilioProvider({ authToken: PLATFORM_MASTER_AUTH_TOKEN });
 *   await twilio.messaging.sendSms({
 *     accountSid: connectedAccountSid,   // from the Connect callback
 *     to, from, body
 *   });
 *
 * The same master Auth Token signs (and therefore validates) the inbound
 * webhooks for connected accounts — `validateTwilioSignature(url, params,
 * header, PLATFORM_MASTER_AUTH_TOKEN)`.
 *
 * @see https://www.twilio.com/docs/iam/connect
 */

/** Base of the Twilio-hosted authorization screen. */
const CONNECT_AUTHORIZE_BASE_URL = 'https://www.twilio.com/authorize';

/**
 * Build the URL to redirect a customer to so they can authorize your Connect
 * App. The redirect-back URL is NOT a parameter here — it is configured on the
 * Connect App itself (Console → ... → Connect Apps → Authorize URL). Twilio
 * echoes the optional `state` back on the callback, so use it for CSRF
 * protection and to correlate the callback with the initiating user/session.
 *
 * @param {Object} params
 * @param {string} params.connectAppSid - your Connect App SID (CN…)
 * @param {string} [params.state]       - opaque value echoed back on the callback (CSRF / correlation)
 * @param {string} [params.baseUrl]     - override the authorize base (testing)
 * @returns {string}
 */
function buildConnectAuthorizeUrl({ connectAppSid, state, baseUrl = CONNECT_AUTHORIZE_BASE_URL } = {}) {
  if (!connectAppSid) {
    throw new Error('twilio.connect: `connectAppSid` is required');
  }
  const base = `${String(baseUrl).replace(/\/+$/, '')}/${encodeURIComponent(connectAppSid)}`;
  if (state === undefined || state === null || state === '') return base;
  const usp = new URLSearchParams();
  usp.set('state', String(state));
  return `${base}?${usp.toString()}`;
}

/**
 * Parse the query of the Connect redirect-back (your Authorize URL).
 *
 * Success → Twilio appends `AccountSid` (the connected subaccount SID) and
 * echoes your `state`. Denial/cancel → no `AccountSid`, usually an `error`
 * param. The shape is defensive about casing so it works whether you read from
 * `req.query` (Express) or a parsed `URLSearchParams`.
 *
 * @param {Object} [query] - the parsed query string of the callback request
 * @returns {{ ok: boolean, accountSid: string|null, state: string|null, error: string|null, errorDescription: string|null }}
 */
function parseConnectCallback(query = {}) {
  const q = query || {};
  const accountSid = q.AccountSid || q.account_sid || null;
  const error = q.error || q.Error || null;
  const errorDescription = q.error_description || q.ErrorMessage || q.error_message || null;
  const state = q.state ?? q.State ?? null;
  return {
    ok: Boolean(accountSid) && !error,
    accountSid: accountSid || null,
    state: state != null ? String(state) : null,
    error: error || null,
    errorDescription: errorDescription || null
  };
}

/**
 * Parse the form-encoded body of the Connect "Deauthorize" callback — Twilio
 * POSTs this to your Connect App's Deauthorize URL when a customer removes your
 * app, so you can mark their channels disconnected.
 *
 * The POST is signed with `X-Twilio-Signature` using YOUR Connect App's Auth
 * Token — validate it with `validateTwilioSignature(url, body, header,
 * masterAuthToken)` before trusting it (this parser does NOT validate; it only
 * extracts the fields).
 *
 * @param {Object} [body] - the `application/x-www-form-urlencoded` request body
 * @returns {{ accountSid: string|null, connectAppSid: string|null }}
 */
function parseConnectDeauthorize(body = {}) {
  const b = body || {};
  return {
    accountSid: b.AccountSid || b.account_sid || null,
    connectAppSid: b.ConnectAppSid || b.connect_app_sid || null
  };
}

/**
 * Convenience manager hung off the provider (`twilio.connect.*`). Mirrors the
 * messaging/media/account managers. Defaults `connectAppSid` from the provider
 * config so the app can configure it once.
 */
class TwilioConnectManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * @param {Object} [opts]
   * @param {string} [opts.connectAppSid] - defaults to provider.connectAppSid
   * @param {string} [opts.state]
   * @param {string} [opts.baseUrl]
   * @returns {string}
   */
  getAuthorizeUrl(opts = {}) {
    return buildConnectAuthorizeUrl({
      connectAppSid: opts.connectAppSid || this.provider.connectAppSid,
      state: opts.state,
      baseUrl: opts.baseUrl
    });
  }

  /** @param {Object} query @returns {ReturnType<typeof parseConnectCallback>} */
  parseCallback(query) {
    return parseConnectCallback(query);
  }

  /** @param {Object} body @returns {ReturnType<typeof parseConnectDeauthorize>} */
  parseDeauthorize(body) {
    return parseConnectDeauthorize(body);
  }
}

module.exports = {
  TwilioConnectManager,
  buildConnectAuthorizeUrl,
  parseConnectCallback,
  parseConnectDeauthorize,
  CONNECT_AUTHORIZE_BASE_URL
};
