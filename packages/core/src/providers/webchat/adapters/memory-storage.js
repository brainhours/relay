/**
 * InMemoryWebchatStorage — zero-dependency reference storage adapter.
 *
 * Production apps should write their own adapter against a real database.
 * This implementation is intended for examples, smoke tests, and POCs.
 * State lives entirely in JS Maps; restarting the process loses all data.
 *
 * Includes a `seedChannel({ widgetKey, accountId, ...config })` helper for
 * test setups so users don't have to wire up an admin CRUD path just to
 * exercise the public webchat flow.
 */

const crypto = require('crypto');
const { WebchatStorageAdapter } = require('./storage');

const DEFAULT_THEME = {
  primaryColor: '#6366f1',
  position: 'bottom-right',
  borderRadius: 16,
  launcherIcon: 'chat',
  fontFamily: 'Inter, system-ui, sans-serif'
};

class InMemoryWebchatStorage extends WebchatStorageAdapter {
  constructor() {
    super();
    this.channels = new Map();           // widgetKey -> channel
    this.channelsById = new Map();       // id -> channel
    this.visitors = new Map();           // id -> visitor
    this.visitorsByToken = new Map();    // token -> visitor
    this.conversations = new Map();      // id -> conversation
    this.messages = [];                  // chronological
    this.contacts = new Map();           // id -> contact
    this.contactsByEmail = new Map();    // accountId|email -> contact
  }

  // ---------------------------------------------------------------------------
  // Test helpers (not part of the WebchatStorageAdapter contract)
  // ---------------------------------------------------------------------------

  /**
   * Insert a channel for testing/demo. Returns the created channel record.
   */
  seedChannel({
    widgetKey,
    accountId = 'demo-account',
    channelId,
    theme = DEFAULT_THEME,
    welcome_message = 'Hi! How can we help?',
    agent_name = 'Support',
    agent_avatar_url = null,
    pre_chat_form = { enabled: false, fields: [] },
    allowed_origins = [],
    offline_message = "We're currently offline. Leave a message and we'll get back to you.",
    is_active = true
  } = {}) {
    if (!widgetKey) throw new Error('seedChannel: widgetKey is required');
    const id = channelId || crypto.randomUUID();
    const channel = {
      id,
      account_id: accountId,
      widget_key: widgetKey,
      theme,
      welcome_message,
      agent_name,
      agent_avatar_url,
      pre_chat_form,
      allowed_origins,
      offline_message,
      is_active
    };
    this.channels.set(widgetKey, channel);
    this.channelsById.set(id, channel);
    return channel;
  }

  // ---------------------------------------------------------------------------
  // Channel config
  // ---------------------------------------------------------------------------

  async getChannelByWidgetKey(widgetKey) {
    return this.channels.get(widgetKey) || null;
  }

  async getPublicWidgetConfig(widgetKey) {
    const c = this.channels.get(widgetKey);
    if (!c || !c.is_active) return null;
    return {
      theme: c.theme,
      welcome_message: c.welcome_message,
      agent_name: c.agent_name,
      agent_avatar_url: c.agent_avatar_url,
      pre_chat_form: c.pre_chat_form,
      offline_message: c.offline_message
    };
  }

  // ---------------------------------------------------------------------------
  // Visitors
  // ---------------------------------------------------------------------------

  async findVisitor(visitorToken) {
    return this.visitorsByToken.get(visitorToken) || null;
  }

  async createVisitor({ accountId, channelId, profile = {}, metadata = {} }) {
    const id = crypto.randomUUID();
    const visitor_token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    const visitor = {
      id,
      account_id: accountId,
      channel_id: channelId,
      visitor_token,
      display_name: profile.name || null,
      email: profile.email || null,
      phone: profile.phone || null,
      contact_id: null,
      metadata,
      first_seen_at: now,
      last_seen_at: now
    };
    this.visitors.set(id, visitor);
    this.visitorsByToken.set(visitor_token, visitor);
    return visitor;
  }

  async updateVisitorIdentity(visitorId, { name, email, phone, contactId } = {}) {
    const v = this.visitors.get(visitorId);
    if (!v) throw new Error(`visitor ${visitorId} not found`);
    if (name !== undefined) v.display_name = name;
    if (email !== undefined) v.email = email;
    if (phone !== undefined) v.phone = phone;
    if (contactId !== undefined) v.contact_id = contactId;
    return v;
  }

  async touchVisitor(visitorId) {
    const v = this.visitors.get(visitorId);
    if (v) v.last_seen_at = new Date().toISOString();
  }

  // ---------------------------------------------------------------------------
  // Contact linking — supported in-memory so /identify exercises the full flow
  // ---------------------------------------------------------------------------

  async findContactByEmail(accountId, email) {
    if (!email) return null;
    return this.contactsByEmail.get(`${accountId}|${email.toLowerCase()}`) || null;
  }

  async createContact(accountId, profile = {}) {
    const id = crypto.randomUUID();
    const contact = {
      id,
      account_id: accountId,
      name: profile.name || null,
      email: profile.email || null,
      phone: profile.phone || null,
      company: profile.company || null,
      created_at: new Date().toISOString()
    };
    this.contacts.set(id, contact);
    if (contact.email) {
      this.contactsByEmail.set(`${accountId}|${contact.email.toLowerCase()}`, contact);
    }
    return contact;
  }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  async findOpenConversationForVisitor(visitorId) {
    for (const c of this.conversations.values()) {
      if (c.webchat_visitor_id === visitorId && c.status !== 'closed') return c;
    }
    return null;
  }

  async createConversation({ accountId, channelId, visitorId, contactId = null }) {
    const id = crypto.randomUUID();
    const conv = {
      id,
      account_id: accountId,
      channel_id: channelId,
      webchat_visitor_id: visitorId,
      contact_id: contactId,
      provider_type: 'WEBCHAT',
      status: 'active',
      last_message_preview: null,
      last_message_at: null,
      unread_count: 0,
      ai_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.conversations.set(id, conv);
    return conv;
  }

  async getConversationForVisitor(conversationId, visitorId) {
    const c = this.conversations.get(conversationId);
    if (!c) return null;
    if (c.webchat_visitor_id !== visitorId) return null;
    return c;
  }

  async setConversationContact(conversationId, contactId) {
    const c = this.conversations.get(conversationId);
    if (c) c.contact_id = contactId;
  }

  async updateConversationOnNewMessage(conversationId, { lastPreview, lastAt, fromVisitor }) {
    const c = this.conversations.get(conversationId);
    if (!c) return;
    c.last_message_preview = lastPreview;
    c.last_message_at = lastAt;
    c.updated_at = new Date().toISOString();
    if (fromVisitor) c.unread_count = (c.unread_count || 0) + 1;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  async insertMessage({ conversationId, accountId, senderType, content, providerType = 'WEBCHAT' }) {
    const id = crypto.randomUUID();
    const msg = {
      id,
      conversation_id: conversationId,
      account_id: accountId,
      sender_type: senderType,
      content,
      provider_type: providerType,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    this.messages.push(msg);
    return msg;
  }

  async loadHistory(conversationId, { limit = 50, before } = {}) {
    let filtered = this.messages.filter((m) => m.conversation_id === conversationId);
    if (before) {
      const beforeIso = new Date(before).toISOString();
      filtered = filtered.filter((m) => m.sent_at < beforeIso);
    }
    // newest first
    return filtered.sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1)).slice(0, limit);
  }
}

module.exports = { InMemoryWebchatStorage };
