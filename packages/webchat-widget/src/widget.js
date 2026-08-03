/**
 * Relay Webchat Widget
 *
 * Embeddable, transport-pluggable chat widget for the @brainhours/relay-core
 * webchat provider.
 *
 * Embed via:
 *   <script
 *     src="https://your-app.com/widget/dist/widget.js"
 *     data-widget-key="<32-char-hex>"
 *     data-api-url="https://your-app.com"
 *     defer
 *   ></script>
 *
 * Realtime transport is decided by the backend at session time and returned in
 * /session response.realtime.transport. SSE and WebSocket are built-in. Custom
 * transports (Ably, Pusher, ...) can be registered via window.RelayWebchat.registerTransport
 * BEFORE the widget connects.
 */

import { getStyles } from './styles.js';
import { launcherIcons, closeIcon, sendIcon } from './icons.js';
import { transports as builtinTransports, registerTransport, getTransport } from './transports/index.js';

(function () {
  'use strict';

  // ---- Public API on window.RelayWebchat ----
  // Even before the widget connects, apps can call registerTransport().
  if (typeof window !== 'undefined') {
    const existing = window.RelayWebchat;
    window.RelayWebchat = {
      // Carry over any registrations done before the widget script loaded
      transports: { ...builtinTransports, ...(existing?.transports || {}) },
      registerTransport(name, factory) {
        registerTransport(name, factory);
        window.RelayWebchat.transports[name] = factory;
      },
      // Imperative controls populated after init()
      open: () => {},
      close: () => {},
      sendMessage: () => {},
      identify: () => {}
    };
  }

  // Find our script tag and extract config
  const scriptTag = document.currentScript || document.querySelector('script[data-widget-key]');
  if (!scriptTag) {
    console.error('[Relay Webchat] No script tag with data-widget-key found');
    return;
  }

  const widgetKey = scriptTag.getAttribute('data-widget-key');
  if (!widgetKey) {
    console.error('[Relay Webchat] Missing data-widget-key attribute');
    return;
  }

  const apiBase = scriptTag.getAttribute('data-api-url');
  if (!apiBase) {
    console.error('[Relay Webchat] Missing data-api-url attribute');
    return;
  }

  const API = `${apiBase}/api/public/webchat/${widgetKey}`;
  const TOKEN_KEY = `relay_vt_${widgetKey}`;

  // ---- State ----
  let config = null;
  let isOpen = false;
  let messages = [];
  let conversationId = null;
  let visitorToken = localStorage.getItem(TOKEN_KEY);
  let realtimeConn = null;
  let unreadCount = 0;
  let isTyping = false;
  let formSubmitted = false;
  let sending = false;

  // ---- DOM refs ----
  let shadow, container, launcher, badge, chatWindow;
  let messagesContainer, inputEl;

  // ---- API helpers ----

  async function apiGet(path) {
    const res = await fetch(`${API}${path}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // ---- Initialization ----

  async function init() {
    try {
      const configRes = await apiGet('/config');
      if (!configRes.success) {
        console.error('[Relay Webchat] Widget not found or inactive');
        return;
      }
      config = configRes.data;
      createWidget();

      // Wire imperative controls
      window.RelayWebchat.open = () => { if (!isOpen) toggleChat(); };
      window.RelayWebchat.close = () => { if (isOpen) closeChat(); };
      window.RelayWebchat.sendMessage = (text) => {
        if (typeof text === 'string' && text.trim() && inputEl) {
          inputEl.value = text;
          handleSend();
        }
      };
      window.RelayWebchat.identify = (profile) => {
        if (visitorToken && profile && typeof profile === 'object') {
          apiPost('/identify', { visitorToken, ...profile }).catch(() => {});
        }
      };
    } catch (err) {
      console.error('[Relay Webchat] Failed to initialize:', err);
    }
  }

  function createWidget() {
    const host = document.createElement('div');
    host.id = 'relay-webchat';
    document.body.appendChild(host);

    shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = getStyles(config.theme || {});
    shadow.appendChild(style);

    container = document.createElement('div');
    container.className = 'relay-widget-container';
    shadow.appendChild(container);

    const launcherIconKey = config.theme?.launcherIcon || 'chat';
    launcher = document.createElement('button');
    launcher.className = 'relay-launcher';
    launcher.innerHTML = launcherIcons[launcherIconKey] || launcherIcons.chat;
    launcher.onclick = toggleChat;
    container.appendChild(launcher);

    badge = document.createElement('span');
    badge.className = 'relay-badge';
    badge.style.display = 'none';
    launcher.appendChild(badge);
  }

  async function toggleChat() {
    if (isOpen) closeChat();
    else await openChat();
  }

  async function openChat() {
    isOpen = true;
    unreadCount = 0;
    updateBadge();
    launcher.innerHTML = closeIcon;

    chatWindow = document.createElement('div');
    chatWindow.className = 'relay-chat-window';
    container.insertBefore(chatWindow, launcher);

    renderHeader();

    const preChatForm = config.pre_chat_form;
    if (preChatForm?.enabled && !formSubmitted && !visitorToken) {
      renderPreChatForm();
    } else {
      await startSession();
    }
  }

  function closeChat() {
    isOpen = false;
    const launcherIconKey = config.theme?.launcherIcon || 'chat';
    launcher.innerHTML = launcherIcons[launcherIconKey] || launcherIcons.chat;
    if (badge.style.display !== 'none') launcher.appendChild(badge);
    if (chatWindow) {
      chatWindow.remove();
      chatWindow = null;
    }
  }

  function renderHeader() {
    const header = document.createElement('div');
    header.className = 'relay-header';

    const avatar = document.createElement('div');
    avatar.className = 'relay-header-avatar';
    if (config.agent_avatar_url) {
      avatar.innerHTML = `<img src="${escapeAttr(config.agent_avatar_url)}" alt="">`;
    } else {
      avatar.textContent = (config.agent_name || 'S').charAt(0);
    }

    const info = document.createElement('div');
    info.className = 'relay-header-info';
    const name = document.createElement('div');
    name.className = 'relay-header-name';
    name.textContent = config.agent_name || 'Support';
    const status = document.createElement('div');
    status.className = 'relay-header-status';
    status.textContent = 'Online';
    info.appendChild(name);
    info.appendChild(status);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'relay-close-btn';
    closeBtn.innerHTML = closeIcon;
    closeBtn.onclick = closeChat;

    header.appendChild(avatar);
    header.appendChild(info);
    header.appendChild(closeBtn);
    chatWindow.appendChild(header);
  }

  function renderPreChatForm() {
    const form = document.createElement('div');
    form.className = 'relay-pre-chat-form';

    const title = document.createElement('h3');
    title.textContent = config.welcome_message || 'Hi! Please introduce yourself.';
    form.appendChild(title);

    const fields = config.pre_chat_form.fields || ['name', 'email'];
    const inputs = {};
    const placeholders = {
      name: 'Your name',
      email: 'your@email.com',
      phone: '+1 (555) 000-0000',
      company: 'Company name'
    };

    fields.forEach((field) => {
      const input = document.createElement('input');
      input.type = field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text';
      input.placeholder = placeholders[field] || field;
      input.name = field;
      if (field === 'name' || field === 'email') input.required = true;
      form.appendChild(input);
      inputs[field] = input;
    });

    const btn = document.createElement('button');
    btn.textContent = 'Start Chat';
    btn.onclick = async () => {
      const data = {};
      fields.forEach((f) => { data[f] = inputs[f].value.trim(); });
      if (fields.includes('email') && !data.email) {
        inputs.email.style.borderColor = '#ef4444';
        return;
      }
      formSubmitted = true;
      form.remove();
      await startSession(data);
    };
    form.appendChild(btn);

    chatWindow.appendChild(form);
  }

  async function startSession(formData) {
    try {
      const sessionRes = await apiPost('/session', {
        visitorToken,
        ...(formData || {}),
        pageUrl: window.location.href,
        referrer: document.referrer
      });

      if (!sessionRes.success) {
        console.error('[Relay Webchat] Session error:', sessionRes.error || sessionRes.message);
        return;
      }

      const session = sessionRes.data;
      conversationId = session.conversationId;
      visitorToken = session.visitorToken;
      localStorage.setItem(TOKEN_KEY, visitorToken);

      if (session.resumed) {
        await loadHistory();
      }

      renderChatArea();

      if (!session.resumed && config.welcome_message) {
        messages.push({
          id: 'welcome',
          sender_type: 'ai',
          content: config.welcome_message,
          sent_at: new Date().toISOString()
        });
        renderMessages();
      }

      // Connect realtime via the configured transport
      if (session.realtime?.transport) {
        connectRealtime(session.realtime);
      } else {
        console.warn('[Relay Webchat] No realtime transport in session response; live updates disabled');
      }
    } catch (err) {
      console.error('[Relay Webchat] Session error:', err);
    }
  }

  async function loadHistory() {
    try {
      const url = `/history?conversationId=${encodeURIComponent(conversationId)}` +
                  `&visitorToken=${encodeURIComponent(visitorToken)}&limit=50`;
      const res = await apiGet(url);
      if (res.success) {
        // Server returns newest-first; widget displays oldest-first
        messages = (res.data || []).slice().reverse();
      }
    } catch (err) {
      console.error('[Relay Webchat] History error:', err);
    }
  }

  function renderChatArea() {
    messagesContainer = document.createElement('div');
    messagesContainer.className = 'relay-messages';
    chatWindow.appendChild(messagesContainer);
    renderMessages();

    const inputArea = document.createElement('div');
    inputArea.className = 'relay-input-area';

    inputEl = document.createElement('input');
    inputEl.className = 'relay-input';
    inputEl.placeholder = 'Type a message...';
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const sendBtn = document.createElement('button');
    sendBtn.className = 'relay-send-btn';
    sendBtn.innerHTML = sendIcon;
    sendBtn.onclick = handleSend;

    inputArea.appendChild(inputEl);
    inputArea.appendChild(sendBtn);
    chatWindow.appendChild(inputArea);

    inputEl.focus();
  }

  function renderMessages() {
    if (!messagesContainer) return;
    messagesContainer.innerHTML = '';

    messages.forEach((msg) => {
      const div = document.createElement('div');
      const isOutgoing = msg.sender_type === 'lead';
      div.className = `relay-message ${isOutgoing ? 'relay-message-out' : 'relay-message-in'}`;
      div.textContent = msg.content;

      const time = document.createElement('div');
      time.className = 'relay-message-time';
      time.textContent = formatTime(msg.sent_at);
      div.appendChild(time);

      messagesContainer.appendChild(div);
    });

    if (isTyping) {
      const typing = document.createElement('div');
      typing.className = 'relay-typing';
      typing.innerHTML =
        '<span class="relay-typing-dot"></span>' +
        '<span class="relay-typing-dot"></span>' +
        '<span class="relay-typing-dot"></span>';
      messagesContainer.appendChild(typing);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function handleSend() {
    if (sending || !inputEl) return;
    const content = inputEl.value.trim();
    if (!content) return;

    sending = true;
    inputEl.value = '';

    // Optimistic update
    const tempMsg = {
      id: 'temp-' + Date.now(),
      sender_type: 'lead',
      content,
      sent_at: new Date().toISOString()
    };
    messages.push(tempMsg);
    renderMessages();

    try {
      await apiPost('/message', { conversationId, visitorToken, content });
    } catch (err) {
      console.error('[Relay Webchat] Send error:', err);
    } finally {
      sending = false;
    }
  }

  // ---- Realtime ----

  function connectRealtime(info) {
    const factory = getTransport(info.transport);
    if (!factory) {
      console.error(
        `[Relay Webchat] Unknown realtime transport: '${info.transport}'.`,
        `Did you forget to call RelayWebchat.registerTransport('${info.transport}', ...)?`
      );
      return;
    }

    if (realtimeConn) {
      try { realtimeConn.close(); } catch { /* noop */ }
    }

    realtimeConn = factory(
      info,
      {
        onMessage: handleIncomingMessage,
        onError: (err) => console.error('[Relay Webchat] Transport error:', err),
        onClose: () => { /* allow GC; widget will reconnect on next session if needed */ }
      },
      { apiBase, conversationId, visitorToken, widgetKey }
    );

    try {
      realtimeConn.connect();
    } catch (err) {
      console.error('[Relay Webchat] Failed to connect realtime:', err);
    }
  }

  function handleIncomingMessage(message) {
    if (!message) return;
    // Skip our own outbound (visitor) messages echoed back by the backend
    if (message.sender_type === 'lead') return;

    isTyping = false;

    messages.push({
      id: message.id,
      sender_type: message.sender_type,
      content: message.content,
      sent_at: message.sent_at || new Date().toISOString()
    });

    if (isOpen) {
      renderMessages();
    } else {
      unreadCount++;
      updateBadge();
    }
  }

  // ---- Helpers ----

  function updateBadge() {
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---- Start ----

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
