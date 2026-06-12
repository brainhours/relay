/**
 * Wati Conversations Manager
 *
 * Operator routing + ticket status — the levers a bot pulls to hand a chat off
 * to a human inside the Wati inbox.
 *
 * Endpoints (header `Authorization: Bearer <token>`):
 *   POST /api/v1/assignOperator?whatsappNumber=...&email=...  - assign to operator or bot
 *   POST /api/v1/updateChatStatus                             - OPEN | SOLVED | PENDING | BLOCK
 *
 * Handoff semantics for an AI agent:
 *   - assignOperator with an `email`  -> chat goes to that human; the bot should
 *     stop replying (the consumer pauses AI on its side).
 *   - assignOperator with NO `email`  -> chat goes back to the Bot.
 *   - updateChatStatus 'SOLVED'       -> closes the ticket (resolution).
 *   - updateChatStatus 'OPEN'         -> (re)opens for human handling.
 *
 * @see https://docs.wati.io/reference/post_api-v1-assignoperator-1
 * @see https://docs.wati.io/reference/post_api-v1-updatechatstatus-1
 */

const VALID_CHAT_STATUSES = ['OPEN', 'SOLVED', 'PENDING', 'BLOCK'];

function cleanNumber(number) {
  return String(number ?? '').replace(/[^\d]/g, '');
}

class WatiConversationsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Assign a conversation to an operator (by email) or back to the Bot (omit email).
   * @param {Object} params
   * @param {string} params.number       - contact WhatsApp number
   * @param {string} [params.email]      - operator email; omit/empty => assign to Bot
   * @returns {Promise<Object>}
   */
  async assignOperator({ apiEndpoint, accessToken, number, email } = {}) {
    const wa = cleanNumber(number);
    const params = { whatsappNumber: wa };
    if (email) params.email = email;
    return this.provider.request({
      method: 'POST',
      path: '/api/v1/assignOperator',
      apiEndpoint,
      accessToken,
      params
    });
  }

  /**
   * Update a conversation's ticket status.
   * @param {Object} params
   * @param {string} params.number              - contact WhatsApp number
   * @param {string} params.ticketStatus        - OPEN | SOLVED | PENDING | BLOCK
   * @param {string} [params.channelPhoneNumber]- channel number (multi-number tenants)
   * @returns {Promise<Object>}
   */
  async updateChatStatus({ apiEndpoint, accessToken, number, ticketStatus, channelPhoneNumber } = {}) {
    const status = String(ticketStatus || '').toUpperCase();
    if (!VALID_CHAT_STATUSES.includes(status)) {
      throw new Error(
        `Wati: invalid ticketStatus '${ticketStatus}'. Valid: ${VALID_CHAT_STATUSES.join(', ')}`
      );
    }
    const wa = cleanNumber(number);
    const data = { whatsappNumber: wa, ticketStatus: status };
    if (channelPhoneNumber) data.channelPhoneNumber = cleanNumber(channelPhoneNumber);
    return this.provider.request({
      method: 'POST',
      path: '/api/v1/updateChatStatus',
      apiEndpoint,
      accessToken,
      data
    });
  }
}

module.exports = { WatiConversationsManager, VALID_CHAT_STATUSES };
