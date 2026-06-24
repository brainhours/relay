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

  /**
   * Assign a chat to Wati TEAM(S) by NAME — Wati runs its OWN distribution
   * (round-robin) to operators within the team. Atribui ao CHAT (remove equipes
   * anteriores automaticamente). É o "transferir pra fila".
   *
   * ⚠️ Requer plano Pro da Wati.
   *
   * Params via query (estilo v1, igual assignOperator):
   *   teams (array<string>, obrigatório), whatsappNumber OU target,
   *   channelPhoneNumber (multi-número).
   *
   * @param {Object} params
   * @param {string[]} params.teams              - nomes das equipes (ex.: ['Suporte'])
   * @param {string} [params.whatsappNumber]     - telefone do contato do chat
   * @param {string} [params.target]             - id/telefone/BSUID (precede whatsappNumber)
   * @param {string} [params.channelPhoneNumber] - número do canal (multi-número)
   * @returns {Promise<Object>} 200 OK
   * @see https://docs.wati.io/reference/post_api-v1-assignteam
   */
  async assignTeams({ apiEndpoint, accessToken, teams, whatsappNumber, target, channelPhoneNumber } = {}) {
    const teamList = Array.isArray(teams) ? teams : [teams].filter(Boolean);
    // `teams` é array<string> em query → serializa repetido (teams=a&teams=b),
    // formato esperado pela Wati. Montamos a query explicitamente pra não
    // depender da serialização default do axios (que usaria teams[]=).
    const qp = teamList.map((tm) => `teams=${encodeURIComponent(tm)}`);
    if (target) qp.push(`target=${encodeURIComponent(target)}`);
    else if (whatsappNumber) qp.push(`whatsappNumber=${encodeURIComponent(cleanNumber(whatsappNumber))}`);
    if (channelPhoneNumber) qp.push(`channelPhoneNumber=${encodeURIComponent(cleanNumber(channelPhoneNumber))}`);

    return this.provider.request({
      method: 'POST',
      path: `/api/v1/assignTeam?${qp.join('&')}`,
      apiEndpoint,
      accessToken
    });
  }
}

module.exports = { WatiConversationsManager, VALID_CHAT_STATUSES };
