/**
 * Unipile — parser de webhook e validação de assinatura.
 *
 * O Unipile é o provider mais antigo do pacote e o de formato mais peculiar: o
 * tipo do evento é a própria CHAVE do objeto, não um campo.
 *
 *   { "MessageReceived": { chat_id, sender, text, ... } }
 *
 * Também é o mais multicanal — o mesmo parser recebe LinkedIn, WhatsApp,
 * Instagram, Telegram e e-mail, e cada canal preenche os campos com nomes
 * diferentes. Daí a cadeia longa de fallback para nome do remetente: LinkedIn
 * manda `attendee_name` ou `first_name`+`last_name`, WhatsApp manda `pushname`.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const {
  parseUnipileWebhook,
  parseUnipileWebhookRaw,
  validateUnipileSignature,
  generateWebhookJobId,
  UNIPILE_EVENT_MAP
} = require('../src/providers/unipile/webhooks');
const { EventTypes } = require('../src/events/types');

const wrap = (chave, dados) => ({ [chave]: dados });

// ───────────────────────────────────────────────────────────────────────────
describe('formato "tipo como chave"', () => {
  test('reconhece o evento pela chave do objeto', () => {
    const ev = parseUnipileWebhook(wrap('MessageReceived', { chat_id: 'c1', text: 'oi' }));
    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(ev.metadata.originalEventKey, 'MessageReceived');
  });

  test('cobre todas as chaves do mapa', () => {
    for (const [chave, esperado] of Object.entries(UNIPILE_EVENT_MAP)) {
      assert.equal(parseUnipileWebhook(wrap(chave, {})).type, esperado, chave);
    }
  });

  test('formato legado com campo event/type ainda funciona', () => {
    assert.equal(parseUnipileWebhookRaw({ event: 'algo' }).eventType, 'algo');
    assert.equal(parseUnipileWebhookRaw({ type: 'outro' }).eventType, 'outro');
  });

  test('payload irreconhecível vira UNKNOWN sem quebrar', () => {
    const ev = parseUnipileWebhook({ ChaveDesconhecida: { x: 1 } });
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.equal(ev.metadata.originalEventKey, null);
  });

  test('corpo nulo, indefinido ou não-objeto não quebra', () => {
    // Regressão: `Object.keys(null)` lançava TypeError e virava 500 na rota —
    // e provider costuma desativar webhook que responde erro repetidamente.
    for (const p of [null, undefined, '', 0, 'texto', []]) {
      const ev = parseUnipileWebhook(p);
      assert.equal(ev.provider, 'unipile');
      assert.equal(ev.type, EventTypes.UNKNOWN);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('campos comuns', () => {
  test('aceita snake_case, camelCase e objeto aninhado', () => {
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { account_id: 'a1' })).accountId, 'a1');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { accountId: 'a2' })).accountId, 'a2');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { account: { id: 'a3' } })).accountId, 'a3');

    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { chat_id: 'c1' })).chatId, 'c1');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { chat: { id: 'c3' } })).chatId, 'c3');
  });

  test('conteúdo aceita text, content, body ou message', () => {
    for (const campo of ['text', 'content', 'body', 'message']) {
      assert.equal(parseUnipileWebhook(wrap('MessageReceived', { [campo]: 'valor' })).content, 'valor', campo);
    }
  });

  test('providerType é normalizado para maiúscula', () => {
    // Sem isso, 'linkedin' não casaria com ProviderTypes.LINKEDIN no consumidor.
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { provider: 'linkedin' })).providerType, 'LINKEDIN');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { provider_type: 'whatsapp' })).providerType, 'WHATSAPP');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { account: { provider: 'telegram' } })).providerType, 'TELEGRAM');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', {})).providerType, undefined);
  });

  test('direção é inferida da chave do evento', () => {
    assert.equal(parseUnipileWebhook(wrap('MessageSent', {})).metadata.direction, 'outbound');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', {})).metadata.direction, 'inbound');
    // qualquer outro evento conta como inbound
    assert.equal(parseUnipileWebhook(wrap('MessageRead', {})).metadata.direction, 'inbound');
  });

  test('timestamp aceita os três nomes e cai para agora', () => {
    const iso = '2026-08-03T12:00:00.000Z';
    for (const campo of ['timestamp', 'created_at', 'date']) {
      assert.equal(parseUnipileWebhook(wrap('MessageReceived', { [campo]: iso })).timestamp, iso, campo);
    }
    assert.ok(!Number.isNaN(Date.parse(parseUnipileWebhook(wrap('MessageReceived', {})).timestamp)));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('nome do remetente — cadeia de fallback multicanal', () => {
  const nomeDe = (sender) => parseUnipileWebhook(wrap('MessageReceived', { sender })).senderName;

  test('precedência: attendee_name > display_name > name > full_name', () => {
    assert.equal(nomeDe({ attendee_name: 'A', display_name: 'B', name: 'C', full_name: 'D' }), 'A');
    assert.equal(nomeDe({ display_name: 'B', name: 'C', full_name: 'D' }), 'B');
    assert.equal(nomeDe({ name: 'C', full_name: 'D' }), 'C');
    assert.equal(nomeDe({ full_name: 'D' }), 'D');
  });

  test('LinkedIn: combina first_name + last_name quando não há nome pronto', () => {
    assert.equal(nomeDe({ first_name: 'Ana', last_name: 'Souza' }), 'Ana Souza');
    assert.equal(nomeDe({ first_name: 'Ana' }), 'Ana');
    assert.equal(nomeDe({ last_name: 'Souza' }), 'Souza');
  });

  test('WhatsApp: pushname é o último recurso', () => {
    assert.equal(nomeDe({ pushname: 'Fulano' }), 'Fulano');
    // perde para qualquer nome estruturado
    assert.equal(nomeDe({ pushname: 'Fulano', name: 'Nome Real' }), 'Nome Real');
  });

  test('sem nenhum campo, fica indefinido', () => {
    assert.equal(nomeDe({}), undefined);
  });

  test('remetente pode vir em sender, from ou attendee', () => {
    for (const campo of ['sender', 'from', 'attendee']) {
      const ev = parseUnipileWebhook(wrap('MessageReceived', { [campo]: { id: 'u1', name: 'X' } }));
      assert.equal(ev.senderId, 'u1', campo);
      assert.equal(ev.senderName, 'X', campo);
    }
  });

  test('senderId aceita id, provider_id e attendee_provider_id', () => {
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { sender: { provider_id: 'p1' } })).senderId, 'p1');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { sender: { attendee_provider_id: 'ap1' } })).senderId, 'ap1');
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', { sender_id: 's1' })).senderId, 's1');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('eventos de relação (convite aceito no LinkedIn)', () => {
  test('NewRelation e RelationCreated montam o bloco de relação', () => {
    for (const chave of ['NewRelation', 'RelationCreated']) {
      const ev = parseUnipileWebhook(wrap(chave, {
        user_id: 'lead-1', profile_url: 'https://linkedin.com/in/x',
        first_name: 'Ana', last_name: 'Souza', headline: 'CTO', company: 'Acme'
      }));
      assert.equal(ev.type, EventTypes.RELATION_CREATED, chave);
      assert.equal(ev.metadata.relation.userId, 'lead-1');
      assert.equal(ev.metadata.relation.headline, 'CTO');
      assert.equal(ev.metadata.relation.company, 'Acme');
    }
  });

  test('aceita provider_id e public_identifier como alternativas', () => {
    const ev = parseUnipileWebhook(wrap('NewRelation', {
      provider_id: 'prov-1', public_identifier: 'ana-souza'
    }));
    assert.equal(ev.metadata.relation.userId, 'prov-1');
    assert.equal(ev.metadata.relation.profileUrl, 'ana-souza');
  });

  test('eventos que não são de relação não ganham o bloco', () => {
    assert.equal(parseUnipileWebhook(wrap('MessageReceived', {})).metadata.relation, undefined);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('anexos', () => {
  test('normaliza os nomes alternativos de cada campo', () => {
    const [a] = parseUnipileWebhook(wrap('MessageReceived', {
      attachments: [{ attachment_id: 'at1', name: 'doc.pdf', mimetype: 'application/pdf', file_size: 999, file_url: 'https://u/doc.pdf' }]
    })).attachments;
    assert.equal(a.id, 'at1');
    assert.equal(a.filename, 'doc.pdf');
    assert.equal(a.mimeType, 'application/pdf');
    assert.equal(a.size, 999);
    assert.equal(a.url, 'https://u/doc.pdf');
  });

  test('sem anexos devolve lista vazia', () => {
    assert.deepEqual(parseUnipileWebhook(wrap('MessageReceived', {})).attachments, []);
    assert.deepEqual(parseUnipileWebhook(wrap('MessageReceived', { attachments: [] })).attachments, []);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('validateUnipileSignature', () => {
  const SECRET = 'segredo-unipile';
  const payload = { MessageReceived: { text: 'oi' } };
  const assinar = (p, s = SECRET) => createHmac('sha256', s).update(JSON.stringify(p)).digest('hex');

  test('assinatura correta é aceita', () => {
    assert.equal(validateUnipileSignature(payload, assinar(payload), SECRET), true);
  });

  test('segredo errado é rejeitado', () => {
    assert.equal(validateUnipileSignature(payload, assinar(payload, 'outro'), SECRET), false);
  });

  test('sem secret ou sem signature, aceita (validação desligada)', () => {
    assert.equal(validateUnipileSignature(payload, null, SECRET), true);
    assert.equal(validateUnipileSignature(payload, assinar(payload), null), true);
  });

  test('assinatura de tamanho diferente é rejeitada, não lança', () => {
    // `timingSafeEqual` lança RangeError com buffers de tamanhos diferentes.
    // Sem a checagem de tamanho, um header curto derrubaria a rota inteira —
    // o mesmo efeito de um crash, alcançável por qualquer requisição.
    assert.equal(validateUnipileSignature(payload, 'curta', SECRET), false);
    assert.equal(validateUnipileSignature(payload, 'a'.repeat(63), SECRET), false);
    assert.equal(validateUnipileSignature(payload, 'a'.repeat(65), SECRET), false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('generateWebhookJobId', () => {
  test('usa messageId', () => {
    const ev = parseUnipileWebhook(wrap('MessageReceived', { account_id: 'a1', message_id: 'm1' }));
    assert.equal(generateWebhookJobId(ev), 'unipile:message.received:a1:m1');
  });

  test('cai para chatId', () => {
    const ev = parseUnipileWebhook(wrap('MessageReceived', { account_id: 'a1', chat_id: 'c1' }));
    assert.equal(generateWebhookJobId(ev), 'unipile:message.received:a1:c1');
  });

  test('é determinístico mesmo sem messageId e chatId', () => {
    // O propósito do jobId é deduplicar na fila. Se o último recurso variar a
    // cada chamada, dois webhooks idênticos geram ids diferentes e ambos são
    // processados — exatamente o que o dedup deveria impedir.
    const ev = parseUnipileWebhook(wrap('AccountStatus', { account_id: 'a1' }));
    assert.equal(generateWebhookJobId(ev), generateWebhookJobId(ev));
  });
});
