/**
 * Unipile — o gerente de usuários do LinkedIn.
 *
 * Mesma regra do teste de empresa: o que importa aqui é a forma exata da
 * requisição (verbo e URL) e, em getRelations, o item que volta — o id da
 * pessoa vem em `member_id` e quem lia `provider_id` ficava com lista vazia.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { UnipileUserManager } = require('../src/providers/unipile/client');

const criarGerente = (retorno = { ok: true }) => {
  const chamadas = [];
  const provider = {
    getBaseUrl: () => 'https://api.unipile.test',
    request: (config) => {
      chamadas.push(config);
      return Promise.resolve(retorno);
    }
  };
  return { gerente: new UnipileUserManager(provider), chamadas };
};

const ULTIMA = (chamadas) => chamadas[chamadas.length - 1];

describe('getOne', () => {
  test('sem seções, URL de sempre', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getOne('a1', 'ACoAAB');
    assert.equal(ULTIMA(chamadas).url, 'https://api.unipile.test/users/ACoAAB?account_id=a1');
  });

  test('seções pedidas viram linkedin_sections separado por vírgula', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getOne('a1', 'ACoAAB', { linkedin_sections: ['experience', 'about'] });
    assert.equal(ULTIMA(chamadas).url, 'https://api.unipile.test/users/ACoAAB?account_id=a1&linkedin_sections=experience%2Cabout');
  });
});

describe('getComments / getReactions', () => {
  test('exigem account_id e identifier', async () => {
    const { gerente } = criarGerente();
    await assert.rejects(() => gerente.getComments({ identifier: 'x' }), /account_id is required/);
    await assert.rejects(() => gerente.getReactions({ account_id: 'a1' }), /identifier is required/);
  });

  test('montam GET no caminho do usuário, com limit e cursor', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getComments({ account_id: 'a1', identifier: 'ACoAAB', limit: 10, cursor: 'c/1' });
    assert.equal(ULTIMA(chamadas).method, 'GET');
    assert.equal(ULTIMA(chamadas).url, 'https://api.unipile.test/users/ACoAAB/comments?account_id=a1&limit=10&cursor=c%2F1');
    await gerente.getReactions({ account_id: 'a1', identifier: 'ACoAAB' });
    assert.equal(ULTIMA(chamadas).url, 'https://api.unipile.test/users/ACoAAB/reactions?account_id=a1');
  });
});

describe('getRelations', () => {
  test('copia member_id para provider_id quando falta, sem mexer no resto', async () => {
    const { gerente } = criarGerente({
      items: [
        { member_id: 'ACoA1', public_identifier: 'ana' },
        { provider_id: 'ACoA2', member_id: 'outro' }
      ],
      cursor: null
    });
    const r = await gerente.getRelations({ account_id: 'a1' });
    assert.equal(r.items[0].provider_id, 'ACoA1');
    assert.equal(r.items[0].member_id, 'ACoA1');
    assert.equal(r.items[1].provider_id, 'ACoA2');
  });
});
