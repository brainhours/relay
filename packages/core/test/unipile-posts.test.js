/**
 * Unipile — criar post.
 *
 * O caminho sem anexo mandava `account_id` só na query string e um corpo
 * `{ text, visibility }`; a Unipile exige `account_id` no corpo e respondia
 * 400 "Required property /account_id". Post com mídia vai por multipart, que
 * já punha o `account_id` no formulário — por isso só o post só-texto falhava.
 * Aqui se testa a forma exata do pedido JSON.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { UnipilePostsManager } = require('../src/providers/unipile/posts');

const criarGerente = () => {
  const chamadas = [];
  const provider = {
    getBaseUrl: () => 'https://api.unipile.test',
    accessToken: 'tok',
    request: (config) => { chamadas.push(config); return Promise.resolve({ object: 'PostCreated', post_id: 'p1' }); }
  };
  return { gerente: new UnipilePostsManager(provider), chamadas };
};

describe('create', () => {
  test('exige account_id e text', async () => {
    const { gerente } = criarGerente();
    await assert.rejects(() => gerente.create({ text: 'oi' }), /account_id is required/);
    await assert.rejects(() => gerente.create({ account_id: 'a1' }), /text is required/);
  });

  test('post só-texto: POST /posts com account_id na query E no corpo', async () => {
    const { gerente, chamadas } = criarGerente();
    const r = await gerente.create({ account_id: 'a1', text: 'Olá, LinkedIn' });
    assert.equal(r.post_id, 'p1');
    const c = chamadas[0];
    assert.equal(c.method, 'POST');
    assert.equal(c.url, 'https://api.unipile.test/posts?account_id=a1');
    assert.deepEqual(c.data, { account_id: 'a1', text: 'Olá, LinkedIn', visibility: 'anyone' });
  });

  test('visibilidade escolhida vai no corpo', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.create({ account_id: 'a1', text: 't', visibility: 'connections' });
    assert.equal(chamadas[0].data.visibility, 'connections');
    assert.equal(chamadas[0].data.account_id, 'a1');
  });
});
