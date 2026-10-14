/**
 * Unipile — reações em post.
 *
 * O `add` mandava para `POST /posts/{id}/reactions` com o tipo em maiúsculas,
 * rota que não existe na v1 (404 "Cannot POST"). A certa é `POST
 * /posts/reaction` com tudo no corpo. Aqui se testa a forma exata do pedido.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { UnipileReactionsManager } = require('../src/providers/unipile/reactions');

const criarGerente = () => {
  const chamadas = [];
  const provider = {
    getBaseUrl: () => 'https://api.unipile.test',
    request: (config) => { chamadas.push(config); return Promise.resolve({ object: 'ReactionAdded' }); }
  };
  return { gerente: new UnipileReactionsManager(provider), chamadas };
};

describe('add', () => {
  test('exige account_id e post_id', async () => {
    const { gerente } = criarGerente();
    await assert.rejects(() => gerente.add({ post_id: 'urn:li:activity:1' }), /account_id is required/);
    await assert.rejects(() => gerente.add({ account_id: 'a1' }), /post_id is required/);
  });

  test('POST /posts/reaction com tudo no corpo e tipo em minúsculas', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.add({ account_id: 'a1', post_id: 'urn:li:activity:1', reaction_type: 'LIKE' });
    const c = chamadas[0];
    assert.equal(c.method, 'POST');
    assert.equal(c.url, 'https://api.unipile.test/posts/reaction');
    assert.deepEqual(c.data, { account_id: 'a1', post_id: 'urn:li:activity:1', reaction_type: 'like' });
  });

  test('padrão é like; comment_id e as_organization vão no corpo', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.add({ account_id: 'a1', post_id: 'p', comment_id: 'c9', as_organization: 'o7' });
    assert.deepEqual(chamadas[0].data, { account_id: 'a1', post_id: 'p', reaction_type: 'like', comment_id: 'c9', as_organization: 'o7' });
  });

  test('recusa tipo desconhecido', async () => {
    const { gerente } = criarGerente();
    await assert.rejects(() => gerente.add({ account_id: 'a1', post_id: 'p', reaction_type: 'wow' }), /Invalid reaction_type/);
  });
});

describe('remove', () => {
  test('falha com not_supported, sem chamar a API', async () => {
    const { gerente, chamadas } = criarGerente();
    await assert.rejects(() => gerente.remove({ account_id: 'a1', post_id: 'p' }), (e) => e.code === 'not_supported');
    assert.equal(chamadas.length, 0);
  });
});
