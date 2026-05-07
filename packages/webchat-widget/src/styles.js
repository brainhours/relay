/**
 * Shadow-DOM CSS for the relay-webchat widget.
 * All classes are prefixed `relay-` to keep the widget's styles fully isolated
 * from the host page (Shadow DOM provides the boundary; the prefix is belt-and-suspenders).
 */

export function getStyles(theme = {}) {
  const primary = theme.primaryColor || '#6366f1';
  const radius = theme.borderRadius || 16;
  const font = theme.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
  const positionLeft = theme.position === 'bottom-left';

  return `
    :host {
      all: initial;
      font-family: ${font};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .relay-widget-container {
      position: fixed;
      ${positionLeft ? 'left: 20px;' : 'right: 20px;'}
      bottom: 20px;
      z-index: 2147483647;
      font-family: ${font};
    }

    .relay-launcher {
      width: 56px;
      height: 56px;
      border-radius: ${radius}px;
      background: ${primary};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
    }
    .relay-launcher:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .relay-launcher svg { fill: white; width: 24px; height: 24px; }

    .relay-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-weight: 600;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }

    .relay-chat-window {
      position: absolute;
      bottom: 70px;
      ${positionLeft ? 'left: 0;' : 'right: 0;'}
      width: 380px;
      max-height: 520px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: relay-slideUp 0.25s ease-out;
    }

    @keyframes relay-slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .relay-header {
      background: ${primary};
      color: white;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .relay-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .relay-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .relay-header-info { flex: 1; min-width: 0; }
    .relay-header-name { font-weight: 600; font-size: 14px; }
    .relay-header-status { font-size: 11px; opacity: 0.8; }
    .relay-close-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      opacity: 0.8;
    }
    .relay-close-btn:hover { opacity: 1; }

    .relay-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 200px;
      max-height: 340px;
    }

    .relay-message {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.4;
      word-break: break-word;
    }
    .relay-message-in {
      background: #f3f4f6;
      color: #1f2937;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .relay-message-out {
      background: ${primary};
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .relay-message-time {
      font-size: 10px;
      opacity: 0.6;
      margin-top: 4px;
    }

    .relay-typing {
      align-self: flex-start;
      padding: 10px 14px;
      background: #f3f4f6;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      display: flex;
      gap: 4px;
    }
    .relay-typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #9ca3af;
      animation: relay-bounce 1.4s ease-in-out infinite;
    }
    .relay-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .relay-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes relay-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .relay-input-area {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .relay-input {
      flex: 1;
      border: 1px solid #d1d5db;
      border-radius: 20px;
      padding: 8px 14px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
      resize: none;
    }
    .relay-input:focus { border-color: ${primary}; }
    .relay-send-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: ${primary};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.2s;
    }
    .relay-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .relay-send-btn svg { fill: white; width: 16px; height: 16px; }

    .relay-pre-chat-form {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .relay-pre-chat-form h3 {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
    .relay-pre-chat-form input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    .relay-pre-chat-form input:focus { border-color: ${primary}; }
    .relay-pre-chat-form button {
      width: 100%;
      padding: 10px;
      background: ${primary};
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
    }
    .relay-pre-chat-form button:hover { opacity: 0.9; }

    .relay-powered {
      text-align: center;
      padding: 6px;
      font-size: 10px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
    }
    .relay-powered a {
      color: #6b7280;
      text-decoration: none;
    }
    .relay-powered a:hover { color: ${primary}; }
  `;
}
