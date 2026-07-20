/**
 * Wati Media Manager
 *
 * A mídia de mensagens do Wati fica no servidor do tenant e exige o Bearer para
 * baixar — não é um link público. O caminho do arquivo (`fileName`) vem no
 * campo `data` de cada item de `conversations.getMessages` (ex:
 * 'data/images/uuid.jpg'). Aqui a gente busca os bytes.
 *
 * @see https://docs.wati.io/   (GET /api/v1/getMedia?fileName=...)
 */

class WatiMediaManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Baixa um arquivo de mídia pelo caminho retornado em getMessages.
   *
   * @param {Object} params
   * @param {string} params.fileName        - caminho vindo de getMessages `data`
   *                                           (ex: 'data/images/uuid.jpg'; um
   *                                           '/' inicial é tolerado).
   * @param {number} [params.maxBytes]       - teto de tamanho (bytes).
   * @returns {Promise<{ buffer: Buffer, mimeType: string|null }>}
   */
  async getMedia({ apiEndpoint, accessToken, fileName, maxBytes } = {}) {
    if (!fileName) throw new Error('Wati.media.getMedia: fileName is required');
    // getMessages às vezes devolve o caminho com '/' inicial; a API não quer.
    const normalized = String(fileName).replace(/^\/+/, '');

    const res = await this.provider.request({
      method: 'GET',
      path: '/api/v1/getMedia',
      apiEndpoint,
      accessToken,
      params: { fileName: normalized },
      responseType: 'arraybuffer',
      maxContentLength: maxBytes
    });

    return { buffer: res.buffer, mimeType: res.contentType };
  }
}

module.exports = { WatiMediaManager };
