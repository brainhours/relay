/**
 * Wati Chatbots Manager
 *
 * Lista e dispara chatbots/automações criados no painel da Wati. Usado pelo
 * handoff "transferir": em vez de a gente escolher equipe/operador (a Wati não
 * deixa listar esses), o cliente cria um chatbot na Wati que faz o roteamento
 * (pra equipe, com round-robin nativo etc.) e a gente só DISPARA esse chatbot.
 *
 * Endpoints (header `Authorization: Bearer <token>`):
 *   GET  /api/v1/chatbots                                   - lista [{ id, name, created }]
 *   POST /api/v1/chatbots/start?chatbotId=&whatsappNumber=  - dispara o chatbot p/ o contato
 *
 * @see https://docs.wati.io/reference/get_api-v1-chatbots-1
 * @see https://docs.wati.io/reference/post_api-v1-chatbots-start-1
 */

function cleanNumber(number) {
  return String(number ?? '').replace(/[^\d]/g, '');
}

class WatiChatbotsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Lista os chatbots do tenant.
   * @returns {Promise<Array>} [{ id, name, created }]
   */
  async list({ apiEndpoint, accessToken } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/api/v1/chatbots',
      apiEndpoint,
      accessToken
    });
  }

  /**
   * Dispara um chatbot para o contato (que então assume a conversa na Wati e
   * roteia conforme a automação configurada lá).
   * @param {Object} params
   * @param {string} params.chatbotId       - id do chatbot (de list())
   * @param {string} params.whatsappNumber  - telefone do contato (com DDI, dígitos)
   * @returns {Promise<Object>} { result: true }
   */
  async start({ apiEndpoint, accessToken, chatbotId, whatsappNumber } = {}) {
    const qp = `chatbotId=${encodeURIComponent(chatbotId)}&whatsappNumber=${encodeURIComponent(cleanNumber(whatsappNumber))}`;
    return this.provider.request({
      method: 'POST',
      path: `/api/v1/chatbots/start?${qp}`,
      apiEndpoint,
      accessToken
    });
  }
}

module.exports = { WatiChatbotsManager };
