/**
 * Wati — parser de webhook e verificação de segredo.
 *
 * O campo decisivo aqui é `owner`, e ele carrega mais peso do que aparenta:
 *
 *   owner=false  → quem escreveu foi o CLIENTE   → MESSAGE_RECEIVED
 *   owner=true   → quem escreveu foi o NEGÓCIO   → MESSAGE_SENT
 *
 * O que o parser deliberadamente NÃO decide é se um `owner=true` veio do bot
 * ou de um atendente humano — os dois chegam idênticos. Essa é política do
 * consumidor, e o parser se limita a expor os sinais necessários no metadata
 * (`localMessageId` para reconhecer o próprio eco, `chatbotTriggeredEventId`
 * para saber que foi automação). Confundir isso faz o app pausar a IA achando
 * que um humano assumiu, quando foi ele mesmo que enviou.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseWatiWebhook,
  validateWatiSignature,
  generateWebhookJobId,
  WATI_EVENT_MAP
} = require('../src/providers/wati/webhooks');
const { EventTypes, ProviderTypes } = require('../src/events/types');

const CANAL = '5511333334444';
const base = (over = {}) => ({
  eventType: 'message',
  waId: '5511988887777',
  whatsappMessageId: 'wamid.ABC',
  channelPhoneNumber: CANAL,
  text: 'Olá',
  timestamp: '1754000000',
  type: 'text',
  ...over
});

// ───────────────────────────────────────────────────────────────────────────
describe('direção pelo campo owner', () => {
  test('owner=false é mensagem do cliente', () => {
    assert.equal(parseWatiWebhook(base({ owner: false })).type, EventTypes.MESSAGE_RECEIVED);
  });

  test('owner ausente também conta como cliente', () => {
    assert.equal(parseWatiWebhook(base()).type, EventTypes.MESSAGE_RECEIVED);
  });

  test('owner=true é mensagem do negócio', () => {
    assert.equal(parseWatiWebhook(base({ owner: true })).type, EventTypes.MESSAGE_SENT);
  });

  test('só o booleano true conta — string "true" não', () => {
    // A comparação é estrita (`=== true`). Se a Wati passar a mandar string,
    // o evento vira MESSAGE_RECEIVED e a IA responderia à própria mensagem.
    assert.equal(parseWatiWebhook(base({ owner: 'true' })).type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(parseWatiWebhook(base({ owner: 1 })).type, EventTypes.MESSAGE_RECEIVED);
  });

  test('owner é espelhado em metadata.owner e metadata.fromMe', () => {
    const ev = parseWatiWebhook(base({ owner: true }));
    assert.equal(ev.metadata.owner, true);
    assert.equal(ev.metadata.fromMe, true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('eventType', () => {
  test('envios de sessão e de template viram MESSAGE_SENT', () => {
    for (const e of ['sessionMessageSent', 'sessionMessageSent_v2', 'templateMessageSent', 'templateMessageSent_v2']) {
      assert.equal(parseWatiWebhook(base({ eventType: e })).type, EventTypes.MESSAGE_SENT, e);
    }
  });

  test('falha de template vira MESSAGE_FAILED', () => {
    for (const e of ['templateMessageFailed', 'templateMessageFailed_v2']) {
      assert.equal(parseWatiWebhook(base({ eventType: e })).type, EventTypes.MESSAGE_FAILED, e);
    }
  });

  test('eventType é case-insensitive', () => {
    assert.equal(parseWatiWebhook(base({ eventType: 'SESSIONMESSAGESENT' })).type, EventTypes.MESSAGE_SENT);
    assert.equal(parseWatiWebhook(base({ eventType: 'SessionMessageSent' })).type, EventTypes.MESSAGE_SENT);
  });

  test('o mapa exportado cobre os eventos documentados', () => {
    for (const k of ['message', 'sessionmessagesent', 'templatemessagesent', 'templatemessagefailed']) {
      assert.ok(k in WATI_EVENT_MAP, k);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('status de entrega via statusString', () => {
  // Nem toda versão da Wati manda eventType distinto para status; quando o
  // eventType não resolve, o statusString é o que sobra.
  const st = (statusString) => parseWatiWebhook(base({ eventType: 'status', statusString })).type;

  test('DELIVERED, READ e FAILED', () => {
    assert.equal(st('DELIVERED'), EventTypes.MESSAGE_DELIVERED);
    assert.equal(st('READ'), EventTypes.MESSAGE_READ);
    assert.equal(st('FAILED'), EventTypes.MESSAGE_FAILED);
  });

  test('é case-insensitive', () => {
    assert.equal(st('delivered'), EventTypes.MESSAGE_DELIVERED);
    assert.equal(st('Read'), EventTypes.MESSAGE_READ);
  });

  test('REPLIED não vira evento próprio — a resposta chega separada', () => {
    // Contá-lo aqui duplicaria a mensagem: o texto da resposta vem depois,
    // como um evento `message`.
    assert.equal(st('REPLIED'), EventTypes.UNKNOWN);
  });

  test('status desconhecido ou ausente → UNKNOWN', () => {
    assert.equal(st('QUEUED'), EventTypes.UNKNOWN);
    assert.equal(st(undefined), EventTypes.UNKNOWN);
  });

  test('statusString não sobrescreve um eventType já reconhecido', () => {
    const ev = parseWatiWebhook(base({ eventType: 'sessionMessageSent', statusString: 'FAILED' }));
    assert.equal(ev.type, EventTypes.MESSAGE_SENT);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('contrato do evento', () => {
  test('mapeia os campos principais', () => {
    const ev = parseWatiWebhook(base({ senderName: 'Joana', owner: false }));
    assert.equal(ev.provider, 'wati');
    assert.equal(ev.providerType, ProviderTypes.WHATSAPP);
    assert.equal(ev.accountId, CANAL);
    assert.equal(ev.chatId, '5511988887777');
    assert.equal(ev.senderId, '5511988887777');
    assert.equal(ev.messageId, 'wamid.ABC');
    assert.equal(ev.senderName, 'Joana');
    assert.equal(ev.content, 'Olá');
  });

  test('accountId cai para channelId quando não há telefone do canal', () => {
    assert.equal(parseWatiWebhook(base({ channelPhoneNumber: undefined, channelId: 'ch-1' })).accountId, 'ch-1');
    assert.equal(parseWatiWebhook(base({ channelPhoneNumber: undefined })).accountId, null);
  });

  test('messageId cai para id', () => {
    assert.equal(parseWatiWebhook(base({ whatsappMessageId: undefined, id: 'wati-id-1' })).messageId, 'wati-id-1');
  });

  test('texto ausente vira string vazia, nunca undefined', () => {
    assert.equal(parseWatiWebhook(base({ text: undefined })).content, '');
  });

  test('timestamp aceita unix em string e cai para `created`', () => {
    assert.equal(parseWatiWebhook(base({ timestamp: '1754000000' })).timestamp, new Date(1754000000 * 1000).toISOString());
    const porCreated = parseWatiWebhook(base({ timestamp: undefined, created: '2026-08-03T10:00:00.000Z' }));
    assert.equal(porCreated.timestamp, '2026-08-03T10:00:00.000Z');
  });

  test('payload nulo ou vazio não quebra', () => {
    for (const p of [null, undefined, {}]) {
      const ev = parseWatiWebhook(p);
      assert.equal(ev.provider, 'wati');
      assert.equal(ev.type, EventTypes.UNKNOWN);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('sinais para distinguir eco do bot de atendente humano', () => {
  test('localMessageId é exposto — é como o app reconhece o próprio envio', () => {
    const ev = parseWatiWebhook(base({ owner: true, localMessageId: 'uuid-que-geramos' }));
    assert.equal(ev.metadata.localMessageId, 'uuid-que-geramos');
  });

  test('chatbotTriggeredEventId indica automação, não humano', () => {
    const ev = parseWatiWebhook(base({ owner: true, chatbotTriggeredEventId: 'evt-bot-1' }));
    assert.equal(ev.metadata.chatbotTriggeredEventId, 'evt-bot-1');
  });

  test('atribuição do operador é preservada', () => {
    const ev = parseWatiWebhook(base({ owner: true, operatorName: 'Carlos', operatorEmail: 'carlos@acme.com' }));
    assert.equal(ev.metadata.operatorName, 'Carlos');
    assert.equal(ev.metadata.operatorEmail, 'carlos@acme.com');
  });

  test('assignedId e assigneeId convergem para o mesmo campo', () => {
    // Wati usa `assignedId` no evento recebido e `assigneeId` no enviado.
    assert.equal(parseWatiWebhook(base({ assignedId: 'op-1' })).metadata.assignedId, 'op-1');
    assert.equal(parseWatiWebhook(base({ assigneeId: 'op-2' })).metadata.assignedId, 'op-2');
  });

  test('campos ausentes são removidos do metadata', () => {
    // A limpeza evita um metadata cheio de undefined, que polui log e storage.
    const ev = parseWatiWebhook(base());
    assert.ok(!('localMessageId' in ev.metadata));
    assert.ok(!('forwarded' in ev.metadata));
  });

  test('respostas interativas são preservadas', () => {
    const listReply = { id: 'l1', title: 'Opção A' };
    assert.deepEqual(parseWatiWebhook(base({ listReply })).metadata.listReply, listReply);
    const buttonReply = { id: 'b1', text: 'Sim' };
    assert.deepEqual(parseWatiWebhook(base({ buttonReply })).metadata.buttonReply, buttonReply);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('anexos', () => {
  test('mensagem de texto não gera anexo', () => {
    assert.deepEqual(parseWatiWebhook(base({ type: 'text', data: 'algo' })).attachments, []);
    assert.deepEqual(parseWatiWebhook(base({ type: undefined })).attachments, []);
  });

  test('data como objeto vira anexo completo', () => {
    const att = parseWatiWebhook(base({
      type: 'image',
      data: { id: 'm1', url: 'https://wati/x.jpg', mimeType: 'image/jpeg', fileName: 'foto.jpg', fileSize: 2048, caption: 'olha' }
    })).attachments;
    assert.equal(att.length, 1);
    assert.equal(att[0].url, 'https://wati/x.jpg');
    assert.equal(att[0].filename, 'foto.jpg');
    assert.equal(att[0].size, 2048);
    assert.equal(att[0].caption, 'olha');
  });

  test('data como string JSON é interpretada', () => {
    const att = parseWatiWebhook(base({
      type: 'document', data: JSON.stringify({ url: 'https://wati/a.pdf', fileName: 'a.pdf' })
    })).attachments;
    assert.equal(att[0].filename, 'a.pdf');
  });

  test('data como URL solta ainda produz anexo utilizável', () => {
    const att = parseWatiWebhook(base({ type: 'image', data: 'https://wati/direct.jpg' })).attachments;
    assert.equal(att.length, 1);
    assert.equal(att[0].url, 'https://wati/direct.jpg');
  });

  test('string que não é URL nem JSON preserva o valor bruto em watiData', () => {
    // Não dá para baixar, mas jogar fora esconderia informação do consumidor.
    const att = parseWatiWebhook(base({ type: 'image', data: 'apenas-um-nome.jpg' })).attachments;
    assert.equal(att.length, 1);
    assert.equal(att[0].url, undefined);
    assert.equal(att[0].watiData, 'apenas-um-nome.jpg');
  });

  test('sem data, não há anexo', () => {
    assert.deepEqual(parseWatiWebhook(base({ type: 'image', data: null })).attachments, []);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('validateWatiSignature', () => {
  test('sem secret configurado, aceita', () => {
    assert.equal(validateWatiSignature({}, 'qualquer', ''), true);
    assert.equal(validateWatiSignature({}, undefined, null), true);
  });

  test('com secret, compara em tempo constante', () => {
    assert.equal(validateWatiSignature({}, 'segredo-123', 'segredo-123'), true);
    assert.equal(validateWatiSignature({}, 'segredo-errado', 'segredo-123'), false);
  });

  test('tamanho diferente é rejeitado de imediato', () => {
    assert.equal(validateWatiSignature({}, 'curto', 'segredo-bem-mais-longo'), false);
  });

  test('assinatura ausente com secret configurado é rejeitada', () => {
    assert.equal(validateWatiSignature({}, undefined, 'segredo'), false);
    assert.equal(validateWatiSignature({}, null, 'segredo'), false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('generateWebhookJobId', () => {
  test('usa messageId', () => {
    const ev = parseWatiWebhook(base({ whatsappMessageId: 'wamid.XYZ' }));
    assert.equal(generateWebhookJobId(ev), `wati:message.received:${CANAL}:wamid.XYZ`);
  });

  test('cai para chatId e depois timestamp', () => {
    const semMsg = parseWatiWebhook(base({ whatsappMessageId: undefined, id: undefined }));
    assert.equal(generateWebhookJobId(semMsg), `wati:message.received:${CANAL}:5511988887777`);
  });
});
