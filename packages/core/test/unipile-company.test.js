/**
 * Unipile — o gerente de empresa do LinkedIn.
 *
 * Estes métodos não têm lógica de negócio: eles MONTAM REQUISIÇÃO. E é aí que
 * mora o erro caro, porque a Unipile aceita corpo malformado calada. Um filtro
 * de empresa escrito no plural (`companies` em vez de `company`) não devolve
 * erro nenhum — devolve uma busca SEM FILTRO, com gente aleatória da rede de
 * quem está logado. Já aconteceu neste arquivo e ficou meses em produção.
 *
 * Por isso o que se testa aqui é a forma exata do que sai: verbo, URL e corpo.
 * O provider é falso e só guarda o que recebeu.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { UnipileCompanyManager } = require('../src/providers/unipile/company');

/** Provider de mentira: registra a chamada e devolve um retorno reconhecível. */
const criarGerente = () => {
  const chamadas = [];
  const provider = {
    getBaseUrl: () => 'https://api.unipile.test',
    request: (config) => {
      chamadas.push(config);
      return Promise.resolve({ ok: true });
    }
  };
  return { gerente: new UnipileCompanyManager(provider), chamadas };
};

const ULTIMA = (chamadas) => chamadas[chamadas.length - 1];

// ───────────────────────────────────────────────────────────────── getOne
describe('getOne', () => {
  test('exige account_id e identifier', async () => {
    const { gerente } = criarGerente();
    await assert.rejects(() => gerente.getOne({ identifier: '1441' }), /account_id is required/);
    await assert.rejects(() => gerente.getOne({ account_id: 'a1' }), /identifier is required/);
  });

  test('monta GET no caminho da empresa', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getOne({ account_id: 'a1', identifier: 'microsoft' });
    const c = ULTIMA(chamadas);
    assert.equal(c.method, 'GET');
    assert.equal(c.url, 'https://api.unipile.test/linkedin/company/microsoft?account_id=a1');
  });

  test('escapa identificador com caractere especial', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getOne({ account_id: 'a1', identifier: 'urn:li:company:1441' });
    assert.match(ULTIMA(chamadas).url, /urn%3Ali%3Acompany%3A1441/);
  });
});

// ──────────────────────────────────────────────────────────── getEmployees
describe('getEmployees', () => {
  test('exige account_id e company_id', async () => {
    const { gerente } = criarGerente();
    await assert.rejects(() => gerente.getEmployees({ company_id: '1441' }), /account_id is required/);
    await assert.rejects(() => gerente.getEmployees({ account_id: 'a1' }), /company_id is required/);
  });

  test('filtro de empresa vai no SINGULAR e como array de string', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getEmployees({ account_id: 'a1', company_id: 1441 });
    const { data } = ULTIMA(chamadas);
    assert.deepEqual(data.company, ['1441']);
    assert.equal(data.companies, undefined);
    assert.equal(data.category, 'people');
    assert.equal(data.api, 'classic');
    assert.equal(data.limit, 25);
  });

  test('job_title aceita string ou array e sempre sai array', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getEmployees({ account_id: 'a1', company_id: '1', job_title: 'CTO' });
    assert.deepEqual(ULTIMA(chamadas).data.job_title, ['CTO']);
    await gerente.getEmployees({ account_id: 'a1', company_id: '1', job_title: ['CTO', 'CEO'] });
    assert.deepEqual(ULTIMA(chamadas).data.job_title, ['CTO', 'CEO']);
  });

  test('opcionais ausentes não entram no corpo', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getEmployees({ account_id: 'a1', company_id: '1' });
    const { data } = ULTIMA(chamadas);
    assert.equal('keywords' in data, false);
    assert.equal('job_title' in data, false);
    assert.equal('cursor' in data, false);
  });
});

// ─────────────────────────────────────────────────────────────── getJobs
describe('getJobs', () => {
  test('exige account_id e company_id', async () => {
    const { gerente } = criarGerente();
    await assert.rejects(() => gerente.getJobs({ company_id: '1441' }), /account_id is required/);
    await assert.rejects(() => gerente.getJobs({ account_id: 'a1' }), /company_id is required/);
  });

  test('é a MESMA busca do getEmployees, trocando a categoria', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getJobs({ account_id: 'a1', company_id: 1441 });
    const c = ULTIMA(chamadas);
    assert.equal(c.method, 'POST');
    assert.equal(c.url, 'https://api.unipile.test/linkedin/search?account_id=a1');
    assert.equal(c.data.category, 'jobs');
    assert.equal(c.data.api, 'classic');
    // O mesmo singular do getEmployees: no plural a Unipile devolve busca
    // global de vagas, sem filtro de empresa, e ninguém percebe.
    assert.deepEqual(c.data.company, ['1441']);
    assert.equal(c.data.limit, 25);
  });

  test('date_posted, cursor e limit viajam quando informados', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getJobs({
      account_id: 'a1', company_id: '1441',
      date_posted: 'past_week', cursor: 'cur1', limit: 50
    });
    const { data } = ULTIMA(chamadas);
    assert.equal(data.date_posted, 'past_week');
    assert.equal(data.cursor, 'cur1');
    assert.equal(data.limit, 50);
  });

  test('location aceita string ou array e sempre sai array', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getJobs({ account_id: 'a1', company_id: '1', location: '106057199' });
    assert.deepEqual(ULTIMA(chamadas).data.location, ['106057199']);
    await gerente.getJobs({ account_id: 'a1', company_id: '1', location: ['1', '2'] });
    assert.deepEqual(ULTIMA(chamadas).data.location, ['1', '2']);
  });

  test('opcionais ausentes não entram no corpo', async () => {
    const { gerente, chamadas } = criarGerente();
    await gerente.getJobs({ account_id: 'a1', company_id: '1' });
    const { data } = ULTIMA(chamadas);
    assert.equal('date_posted' in data, false);
    assert.equal('location' in data, false);
    assert.equal('cursor' in data, false);
  });
});
