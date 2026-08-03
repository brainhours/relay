/**
 * Wati Chatbots Manager
 *
 * Lists and triggers chatbots/automations built in the Wati dashboard. This is
 * how a "transfer" handoff works: Wati exposes no API to list teams or
 * operators, so instead of picking one here, the customer builds a chatbot in
 * Wati that does the routing (to a team, with native round-robin, etc.) and we
 * only TRIGGER that chatbot.
 *
 * Endpoints (header `Authorization: Bearer <token>`):
 *   GET  /api/v1/chatbots                                   - lists [{ id, name, created }]
 *   POST /api/v1/chatbots/start?chatbotId=&whatsappNumber=  - triggers the chatbot for a contact
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
   * Lists the tenant's chatbots.
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
   * Triggers a chatbot for a contact. The bot then takes over the conversation
   * inside Wati and routes it per the automation configured there.
   * @param {Object} params
   * @param {string} params.chatbotId       - chatbot id (from list())
   * @param {string} params.whatsappNumber  - contact phone (country code, digits only)
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
