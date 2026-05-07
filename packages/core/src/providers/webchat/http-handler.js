/**
 * createWebchatHandler — Express factory mounting the 5 public webchat routes.
 *
 * Routes (mounted under whatever prefix the app uses; typical: /api/public/webchat):
 *   GET  /:widgetKey/config       → public widget config (theme, greeting, agent name, etc.)
 *   POST /:widgetKey/session      → create / resume a visitor session, return realtime info
 *   POST /:widgetKey/message      → visitor sends a message; persisted + fan-out + emitter
 *   POST /:widgetKey/identify     → visitor provides name/email/phone; optionally links contact
 *   GET  /:widgetKey/history      → paginated message history (ownership-checked)
 *
 * Plus, if the realtime adapter requires it (SSE/WS):
 *   The adapter's `attachServerHandlers(router, { storage })` is called once
 *   to mount transport-specific endpoints (e.g. GET /_relay/sse).
 *
 * Defaults are deliberately conservative; everything is overridable through opts.
 */

const { isValidVisitorTokenFormat } = require('./tokens');
const { parseWebchatWebhook } = require('./webhooks');

/** Lazy-load Express so apps that never call createWebchatHandler don't need it. */
function loadExpress() {
  try {
    return require('express');
  } catch {
    throw new Error(
      "createWebchatHandler requires the 'express' package. Install it with: npm i express"
    );
  }
}

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 100;
const MAX_MESSAGE_LENGTH = 5000;
const CHANNEL_CACHE_TTL_MS = 60_000;
const SESSION_RATE_LIMIT = { windowMs: 60_000, max: 10 };
const MESSAGE_RATE_LIMIT = { windowMs: 60_000, max: 30 };

/**
 * Send a normalized error response.
 */
function sendError(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function sendOk(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

/**
 * Try to load `express-rate-limit` (peer dep). Returns a middleware that
 * is a no-op if the package isn't installed.
 */
function tryLoadRateLimit(opts) {
  try {
    const rateLimit = require('express-rate-limit');
    return rateLimit({
      windowMs: opts.windowMs,
      limit: opts.max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, error: { code: 'rate_limited', message: 'Too many requests' } }
    });
  } catch {
    return (_req, _res, next) => next();
  }
}

/**
 * Build a per-request CORS middleware that consults the channel's
 * `allowed_origins` array. Empty array = allow all (useful in dev).
 *
 * Uses a tiny in-process cache to avoid hitting the storage adapter on
 * every preflight + request pair.
 */
function buildDynamicCors(storage) {
  const cache = new Map();   // widgetKey -> { allowed: string[], expiresAt }

  async function getAllowed(widgetKey) {
    const now = Date.now();
    const hit = cache.get(widgetKey);
    if (hit && hit.expiresAt > now) return hit.allowed;
    let allowed = null;
    try {
      const channel = await storage.getChannelByWidgetKey(widgetKey);
      if (channel) allowed = channel.allowed_origins || [];
    } catch {
      allowed = null;
    }
    cache.set(widgetKey, { allowed, expiresAt: now + CHANNEL_CACHE_TTL_MS });
    return allowed;
  }

  return async function dynamicCors(req, res, next) {
    const origin = req.headers.origin;
    const widgetKey = req.params.widgetKey;
    if (!widgetKey) return next();

    const allowed = await getAllowed(widgetKey);
    // Channel doesn't exist: let the handler return 404; for CORS, deny.
    if (allowed === null) return next();

    const allowOrigin =
      allowed.length === 0
        ? (origin || '*')
        : (origin && allowed.includes(origin) ? origin : null);

    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      return res.status(allowOrigin ? 204 : 403).end();
    }
    next();
  };
}

/**
 * Resolve the visitor + active conversation given a token + (optionally) an
 * existing conversationId. Returns { channel, visitor, conversation } or
 * sends an error response and returns null.
 */
async function resolveVisitor(req, res, storage, { requireConversationId = false } = {}) {
  const widgetKey = req.params.widgetKey;
  const visitorToken = req.body?.visitorToken || req.query?.visitorToken;
  const conversationId = req.body?.conversationId || req.query?.conversationId;

  if (!widgetKey) {
    sendError(res, 400, 'missing_widget_key', 'widgetKey is required');
    return null;
  }
  if (!visitorToken || !isValidVisitorTokenFormat(visitorToken)) {
    sendError(res, 400, 'invalid_visitor_token', 'visitorToken is required and must be a hex string');
    return null;
  }
  if (requireConversationId && !conversationId) {
    sendError(res, 400, 'missing_conversation_id', 'conversationId is required');
    return null;
  }

  const channel = await storage.getChannelByWidgetKey(widgetKey);
  if (!channel || !channel.is_active) {
    sendError(res, 404, 'channel_not_found', 'channel not found or inactive');
    return null;
  }

  const visitor = await storage.findVisitor(visitorToken);
  if (!visitor || visitor.channel_id !== channel.id) {
    sendError(res, 403, 'invalid_visitor', 'visitor not recognized for this channel');
    return null;
  }

  let conversation = null;
  if (conversationId) {
    conversation = await storage.getConversationForVisitor(conversationId, visitor.id);
    if (!conversation) {
      sendError(res, 403, 'invalid_conversation', 'conversation does not belong to this visitor');
      return null;
    }
  }

  return { channel, visitor, conversation };
}

/**
 * Factory: builds an Express router with all webchat routes wired.
 *
 * @param {Object} opts
 * @param {import('./adapters/storage').WebchatStorageAdapter}  opts.storage
 * @param {import('./adapters/realtime').WebchatRealtimeAdapter} opts.realtime
 * @param {Object}  [opts.emitter]                             - MessagingEventEmitter; visitor messages are emitted here
 * @param {Function} [opts.generateVisitorToken]               - override default 32-byte hex generator
 * @param {Function} [opts.rateLimitMessage]                   - express middleware; default uses express-rate-limit if installed
 * @param {Function} [opts.rateLimitSession]                   - express middleware; default uses express-rate-limit if installed
 * @param {Function} [opts.cors]                               - express middleware; default = buildDynamicCors(storage)
 * @returns {import('express').Router}
 */
function createWebchatHandler(opts = {}) {
  const { storage, realtime, emitter } = opts;
  if (!storage) throw new Error('createWebchatHandler: storage is required');
  if (!realtime) throw new Error('createWebchatHandler: realtime is required');

  const express = loadExpress();
  const cors = opts.cors || buildDynamicCors(storage);
  const rateLimitMessage = opts.rateLimitMessage || tryLoadRateLimit(MESSAGE_RATE_LIMIT);
  const rateLimitSession = opts.rateLimitSession || tryLoadRateLimit(SESSION_RATE_LIMIT);

  // Note: opts.generateVisitorToken is forwarded to storage.createVisitor via the
  // storage adapter contract; the factory itself does not need it.

  const router = express.Router();

  // JSON body parser scoped to this sub-router (caller does not need to mount one)
  router.use(express.json({ limit: '256kb' }));

  // Apply CORS to every webchat route (incl. preflight)
  router.options('/:widgetKey/*', cors);
  router.use('/:widgetKey/*', cors);

  // Let the realtime adapter add its own routes (e.g. SSE endpoint)
  if (typeof realtime.attachServerHandlers === 'function') {
    realtime.attachServerHandlers(router, { storage });
  }

  // ---------------------------------------------------------------------------
  // GET /:widgetKey/config
  // ---------------------------------------------------------------------------

  router.get('/:widgetKey/config', async (req, res) => {
    try {
      const config = await storage.getPublicWidgetConfig(req.params.widgetKey);
      if (!config) return sendError(res, 404, 'channel_not_found', 'channel not found or inactive');
      return sendOk(res, config);
    } catch (err) {
      return sendError(res, 500, 'internal', err.message);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:widgetKey/session
  // Body: { visitorToken?, name?, email?, phone? }
  // ---------------------------------------------------------------------------

  router.post('/:widgetKey/session', rateLimitSession, async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const { visitorToken, name, email, phone } = req.body || {};

      const channel = await storage.getChannelByWidgetKey(widgetKey);
      if (!channel || !channel.is_active) {
        return sendError(res, 404, 'channel_not_found', 'channel not found or inactive');
      }

      let visitor = null;
      let resumed = false;

      if (visitorToken && isValidVisitorTokenFormat(visitorToken)) {
        visitor = await storage.findVisitor(visitorToken);
        if (visitor && visitor.channel_id === channel.id) {
          resumed = true;
        } else {
          visitor = null;
        }
      }

      if (!visitor) {
        const metadata = {
          ip: req.ip,
          userAgent: req.headers['user-agent'] || null,
          referrer: req.headers['referer'] || null,
          pageUrl: req.body?.pageUrl || null
        };
        visitor = await storage.createVisitor({
          accountId: channel.account_id,
          channelId: channel.id,
          profile: { name, email, phone },
          metadata
        });
      } else {
        await storage.touchVisitor(visitor.id);
      }

      let conversation = await storage.findOpenConversationForVisitor(visitor.id);
      if (!conversation) {
        conversation = await storage.createConversation({
          accountId: channel.account_id,
          channelId: channel.id,
          visitorId: visitor.id,
          contactId: visitor.contact_id || null
        });
      }

      const realtimeInfo = await realtime.getWidgetConnectionInfo({
        conversationId: conversation.id,
        visitorToken: visitor.visitor_token,
        accountId: channel.account_id,
        mountPath: req.baseUrl || ''
      });

      return sendOk(res, {
        conversationId: conversation.id,
        visitorToken: visitor.visitor_token,
        realtime: realtimeInfo,
        resumed
      });
    } catch (err) {
      return sendError(res, 500, 'internal', err.message);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:widgetKey/message
  // Body: { conversationId, visitorToken, content }
  // ---------------------------------------------------------------------------

  router.post('/:widgetKey/message', rateLimitMessage, async (req, res) => {
    try {
      const { content } = req.body || {};
      if (typeof content !== 'string' || content.length === 0) {
        return sendError(res, 400, 'invalid_content', 'content must be a non-empty string');
      }
      if (content.length > MAX_MESSAGE_LENGTH) {
        return sendError(res, 400, 'message_too_long', `content must be <= ${MAX_MESSAGE_LENGTH} chars`);
      }

      const ctx = await resolveVisitor(req, res, storage, { requireConversationId: true });
      if (!ctx) return;
      const { channel, visitor, conversation } = ctx;

      // Persist
      const message = await storage.insertMessage({
        conversationId: conversation.id,
        accountId: channel.account_id,
        senderType: 'lead',
        content,
        providerType: 'WEBCHAT'
      });

      await storage.updateConversationOnNewMessage(conversation.id, {
        lastPreview: content.slice(0, 200),
        lastAt: message.sent_at,
        fromVisitor: true
      });
      await storage.touchVisitor(visitor.id);

      // Realtime fan-out (best effort)
      if (realtime.isAvailable()) {
        try {
          await realtime.publish(`conversation:${conversation.id}`, 'new_message', {
            conversationId: conversation.id,
            message
          });
          await realtime.publish(`account:${channel.account_id}`, 'new_message', {
            accountId: channel.account_id,
            conversationId: conversation.id,
            message
          });
        } catch {
          // best-effort
        }
      }

      // Emit NormalizedEvent — AI / dashboard handlers see this on the same
      // emitter as Unipile/Uazapi messages.
      if (emitter) {
        const event = parseWebchatWebhook({
          widgetKey: req.params.widgetKey,
          accountId: channel.account_id,
          channelId: channel.id,
          conversationId: conversation.id,
          messageId: message.id,
          senderType: 'lead',
          content,
          sentAt: message.sent_at,
          visitor: {
            id: visitor.id,
            token: visitor.visitor_token,
            name: visitor.display_name,
            email: visitor.email,
            phone: visitor.phone,
            contactId: visitor.contact_id,
            metadata: visitor.metadata
          }
        });
        try {
          await emitter.emit(event, { req });
        } catch {
          // emit handler errors must not break the visitor's request
        }
      }

      return sendOk(res, { messageId: message.id });
    } catch (err) {
      return sendError(res, 500, 'internal', err.message);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /:widgetKey/identify
  // Body: { visitorToken, name?, email?, phone?, company? }
  // ---------------------------------------------------------------------------

  router.post('/:widgetKey/identify', async (req, res) => {
    try {
      const { name, email, phone, company } = req.body || {};

      const ctx = await resolveVisitor(req, res, storage);
      if (!ctx) return;
      const { channel, visitor } = ctx;

      // Optional contact linking
      let contactId = visitor.contact_id;
      if (email && typeof storage.findContactByEmail === 'function') {
        try {
          const found = await storage.findContactByEmail(channel.account_id, email);
          if (found?.id) {
            contactId = found.id;
          } else if (typeof storage.createContact === 'function') {
            const created = await storage.createContact(channel.account_id, { name, email, phone, company });
            if (created?.id) contactId = created.id;
          }
        } catch {
          // contact linking is optional; ignore failures
        }
      }

      const updated = await storage.updateVisitorIdentity(visitor.id, {
        name, email, phone, contactId
      });

      // If contact changed and there's an open conversation, propagate
      if (contactId && contactId !== visitor.contact_id) {
        const conv = await storage.findOpenConversationForVisitor(visitor.id);
        if (conv) await storage.setConversationContact(conv.id, contactId);
      }

      return sendOk(res, {
        contactId: updated.contact_id || contactId || null,
        visitor_name: updated.display_name || name || null
      });
    } catch (err) {
      return sendError(res, 500, 'internal', err.message);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /:widgetKey/history
  // Query: { conversationId, visitorToken, limit?, before? }
  // ---------------------------------------------------------------------------

  router.get('/:widgetKey/history', async (req, res) => {
    try {
      const limit = Math.min(
        parseInt(req.query.limit, 10) || DEFAULT_HISTORY_LIMIT,
        MAX_HISTORY_LIMIT
      );
      const before = req.query.before || null;

      const ctx = await resolveVisitor(req, res, storage, { requireConversationId: true });
      if (!ctx) return;

      const messages = await storage.loadHistory(ctx.conversation.id, { limit, before });
      return sendOk(res, messages);
    } catch (err) {
      return sendError(res, 500, 'internal', err.message);
    }
  });

  return router;
}

module.exports = { createWebchatHandler };
