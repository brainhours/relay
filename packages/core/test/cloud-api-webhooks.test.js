/**
 * Meta WhatsApp Cloud API — parser de webhook e validação de assinatura.
 *
 * Estes testes descrevem o comportamento ATUAL do parser, não o desejado: são
 * uma rede para refactor, e qualquer divergência aqui é regressão até que se
 * prove o contrário.
 *
 * O que torna o Cloud API diferente dos outros providers:
 *   - um POST carrega MUITOS eventos (Meta agrupa até 100 mensagens por change),
 *     então `parseCloudApiWebhook` devolve ARRAY, e não um evento;
 *   - a mesma `value` pode trazer `messages`, `statuses` E `errors` juntos;
 *   - o nome do contato não vem na mensagem: vem em `contacts[]`, casado por
 *     `wa_id` — errar esse pareamento faz toda conversa ficar sem nome.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const {
  parseCloudApiWebhook,
  validateCloudApiSignature,
  generateWebhookJobId
} = require('../src/providers/cloud-api/webhooks');
const { EventTypes, ProviderTypes } = require('../src/events/types');

const WABA = '109876543210987';
const PHONE_ID = '15550001111';

/** Monta o envelope que a Meta POSTa, com uma única `change`. */
const envelope = (field, value) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: WABA, changes: [{ field, value }] }]
});

/** `value` de `field: 'messages'` já com o metadata que carrega o phone_number_id. */
const messagesValue = (extra) => ({
  messaging_product: 'whatsapp',
  metadata: { display_phone_number: '5511999999999', phone_number_id: PHONE_ID },
  ...extra
});

const textMessage = (over = {}) => ({
  from: '5511988887777',
  id: 'wamid.HBgNNTUxMTk4ODg4Nzc3NxUCABIYFjNBMEQ2',
  timestamp: '1754000000',
  type: 'text',
  text: { body: 'Olá!' },
  ...over
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — envelope', () => {
  test('ignora payload que não é whatsapp_business_account', () => {
    // A mesma URL pode receber webhook de outros produtos Meta (Instagram,
    // Messenger). Tratar esses como WhatsApp criaria eventos fantasma.
    assert.deepEqual(parseCloudApiWebhook({ object: 'instagram', entry: [] }), []);
    assert.deepEqual(parseCloudApiWebhook({ object: 'page' }), []);
  });

  test('não quebra com payload vazio, nulo ou sem argumento', () => {
    assert.deepEqual(parseCloudApiWebhook({}), []);
    assert.deepEqual(parseCloudApiWebhook(null), []);
    assert.deepEqual(parseCloudApiWebhook(), []);
  });

  test('tolera entry/changes ausentes', () => {
    assert.deepEqual(parseCloudApiWebhook({ object: 'whatsapp_business_account' }), []);
    assert.deepEqual(
      parseCloudApiWebhook({ object: 'whatsapp_business_account', entry: [{ id: WABA }] }),
      []
    );
  });

  test('percorre múltiplos entries e múltiplas changes', () => {
    const events = parseCloudApiWebhook({
      object: 'whatsapp_business_account',
      entry: [
        { id: WABA, changes: [
          { field: 'messages', value: messagesValue({ messages: [textMessage()] }) },
          { field: 'messages', value: messagesValue({ messages: [textMessage({ id: 'wamid.2' })] }) }
        ] },
        { id: 'outra-waba', changes: [
          { field: 'messages', value: messagesValue({ messages: [textMessage({ id: 'wamid.3' })] }) }
        ] }
      ]
    });
    assert.equal(events.length, 3);
    assert.deepEqual(events.map(e => e.messageId), ['wamid.HBgNNTUxMTk4ODg4Nzc3NxUCABIYFjNBMEQ2', 'wamid.2', 'wamid.3']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — mensagem inbound', () => {
  test('mapeia os campos do contrato NormalizedEvent', () => {
    const [ev] = parseCloudApiWebhook(
      envelope('messages', messagesValue({ messages: [textMessage()] }))
    );

    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(ev.provider, 'cloud-api');
    assert.equal(ev.providerType, ProviderTypes.WHATSAPP);
    // accountId é o phone_number_id (não a WABA): é ele que identifica o canal
    assert.equal(ev.accountId, PHONE_ID);
    assert.equal(ev.chatId, '5511988887777');
    assert.equal(ev.senderId, '5511988887777');
    assert.equal(ev.content, 'Olá!');
    assert.equal(ev.metadata.messageType, 'text');
    assert.equal(ev.metadata.wabaId, WABA);
    assert.deepEqual(ev.attachments, []);
  });

  test('converte o timestamp unix (segundos) para ISO', () => {
    const [ev] = parseCloudApiWebhook(
      envelope('messages', messagesValue({ messages: [textMessage({ timestamp: '1754000000' })] }))
    );
    assert.equal(ev.timestamp, new Date(1754000000 * 1000).toISOString());
  });

  test('timestamp ausente ou não numérico cai para "agora" em vez de Invalid Date', () => {
    for (const ts of [undefined, 'abc', null]) {
      const [ev] = parseCloudApiWebhook(
        envelope('messages', messagesValue({ messages: [textMessage({ timestamp: ts })] }))
      );
      assert.ok(!Number.isNaN(Date.parse(ev.timestamp)), `timestamp inválido para ${ts}`);
    }
  });

  test('casa o nome do contato por wa_id', () => {
    const [ev] = parseCloudApiWebhook(
      envelope('messages', messagesValue({
        contacts: [
          { wa_id: '5511900000000', profile: { name: 'Outra Pessoa' } },
          { wa_id: '5511988887777', profile: { name: 'Joana Silva' } }
        ],
        messages: [textMessage()]
      }))
    );
    // pareamento por wa_id, não por posição no array
    assert.equal(ev.senderName, 'Joana Silva');
  });

  test('senderName é null quando não há contato correspondente', () => {
    const [ev] = parseCloudApiWebhook(
      envelope('messages', messagesValue({
        contacts: [{ wa_id: 'outro-numero', profile: { name: 'Fulano' } }],
        messages: [textMessage()]
      }))
    );
    assert.equal(ev.senderName, null);
  });

  test('agrupa até N mensagens do mesmo change (batching da Meta)', () => {
    const msgs = Array.from({ length: 25 }, (_, i) => textMessage({ id: `wamid.${i}` }));
    const events = parseCloudApiWebhook(envelope('messages', messagesValue({ messages: msgs })));
    assert.equal(events.length, 25);
    assert.ok(events.every(e => e.type === EventTypes.MESSAGE_RECEIVED));
  });

  test('preserva o payload original em raw', () => {
    const msg = textMessage();
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({ messages: [msg] })));
    assert.deepEqual(ev.raw, msg);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — extração de conteúdo', () => {
  const contentOf = (over) => {
    const [ev] = parseCloudApiWebhook(
      envelope('messages', messagesValue({ messages: [textMessage(over)] }))
    );
    return ev.content;
  };

  test('texto simples', () => {
    assert.equal(contentOf({ type: 'text', text: { body: 'mensagem' } }), 'mensagem');
  });

  test('resposta de botão usa o texto do botão', () => {
    assert.equal(
      contentOf({ type: 'button', text: undefined, button: { text: 'Confirmar', payload: 'CONF' } }),
      'Confirmar'
    );
  });

  test('interactive: button_reply, list_reply e nfm_reply', () => {
    assert.equal(contentOf({ text: undefined, interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'Sim' } } }), 'Sim');
    assert.equal(contentOf({ text: undefined, interactive: { type: 'list_reply', list_reply: { id: 'l1', title: 'Opção A' } } }), 'Opção A');
    assert.equal(contentOf({ text: undefined, interactive: { type: 'nfm_reply', nfm_reply: { body: 'flow-body' } } }), 'flow-body');
  });

  test('mídia usa a legenda quando existe', () => {
    assert.equal(contentOf({ type: 'image', text: undefined, image: { id: 'm1', caption: 'legenda da foto' } }), 'legenda da foto');
    assert.equal(contentOf({ type: 'video', text: undefined, video: { id: 'm2', caption: 'legenda do vídeo' } }), 'legenda do vídeo');
    assert.equal(contentOf({ type: 'document', text: undefined, document: { id: 'm3', caption: 'legenda do doc' } }), 'legenda do doc');
  });

  test('mídia sem legenda resulta em conteúdo vazio, nunca undefined', () => {
    assert.equal(contentOf({ type: 'image', text: undefined, image: { id: 'm1' } }), '');
  });

  test('localização usa o nome, ou as coordenadas quando não há nome', () => {
    assert.equal(contentOf({ type: 'location', text: undefined, location: { latitude: -23.5, longitude: -46.6, name: 'Av. Paulista' } }), 'Av. Paulista');
    assert.equal(contentOf({ type: 'location', text: undefined, location: { latitude: -23.5, longitude: -46.6 } }), '-23.5,-46.6');
  });

  test('contato usa formatted_name, com fallback para first_name', () => {
    assert.equal(contentOf({ type: 'contacts', text: undefined, contacts: [{ name: { formatted_name: 'Maria Souza' } }] }), 'Maria Souza');
    assert.equal(contentOf({ type: 'contacts', text: undefined, contacts: [{ name: { first_name: 'Maria' } }] }), 'Maria');
  });

  test('tipo desconhecido não quebra: conteúdo vazio', () => {
    assert.equal(contentOf({ type: 'order', text: undefined, order: { catalog_id: 'x' } }), '');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — anexos', () => {
  const attachmentsOf = (over) => {
    const [ev] = parseCloudApiWebhook(
      envelope('messages', messagesValue({ messages: [textMessage(over)] }))
    );
    return ev.attachments;
  };

  test('extrai imagem com mime, sha256 e o media_id da Meta', () => {
    const att = attachmentsOf({
      type: 'image', text: undefined,
      image: { id: 'media-123', mime_type: 'image/jpeg', sha256: 'abc123' }
    });
    assert.equal(att.length, 1);
    assert.deepEqual(att[0], {
      id: 'media-123', type: 'image', filename: undefined,
      mimeType: 'image/jpeg', sha256: 'abc123'
    });
  });

  test('cobre os cinco tipos de mídia', () => {
    for (const [k, extra] of [
      ['image', {}], ['video', {}], ['audio', {}],
      ['document', { filename: 'contrato.pdf' }], ['sticker', {}]
    ]) {
      const att = attachmentsOf({ type: k, text: undefined, [k]: { id: `id-${k}`, ...extra } });
      assert.equal(att.length, 1, `${k} deveria gerar 1 anexo`);
      assert.equal(att[0].type, k);
    }
  });

  test('mídia sem id é ignorada (não dá para baixar sem media_id)', () => {
    assert.deepEqual(attachmentsOf({ type: 'image', text: undefined, image: { mime_type: 'image/png' } }), []);
  });

  test('preserva filename de documento', () => {
    const att = attachmentsOf({
      type: 'document', text: undefined,
      document: { id: 'd1', filename: 'nota-fiscal.pdf', mime_type: 'application/pdf' }
    });
    assert.equal(att[0].filename, 'nota-fiscal.pdf');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — metadata contextual', () => {
  test('resposta a mensagem preenche o contexto', () => {
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({
      messages: [textMessage({ context: { id: 'wamid.original', from: '5511999999999', forwarded: true } })]
    })));
    assert.equal(ev.metadata.contextMessageId, 'wamid.original');
    assert.equal(ev.metadata.contextFrom, '5511999999999');
    assert.equal(ev.metadata.contextForwarded, true);
  });

  test('referral (clique em anúncio) é preservado', () => {
    const referral = { source_url: 'https://fb.me/x', source_type: 'ad', source_id: '123' };
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({
      messages: [textMessage({ referral })]
    })));
    assert.deepEqual(ev.metadata.referral, referral);
  });

  test('payload do botão vai para metadata (o title vira content)', () => {
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({
      messages: [textMessage({ type: 'button', text: undefined, button: { text: 'Sim', payload: 'CONFIRMA_123' } })]
    })));
    assert.equal(ev.content, 'Sim');
    assert.equal(ev.metadata.buttonPayload, 'CONFIRMA_123');
  });

  test('reaction é preservada', () => {
    const reaction = { message_id: 'wamid.alvo', emoji: '👍' };
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({
      messages: [textMessage({ type: 'reaction', text: undefined, reaction })]
    })));
    assert.deepEqual(ev.metadata.reaction, reaction);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — status de entrega', () => {
  const statusEvent = (status) => {
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({
      statuses: [{ id: 'wamid.enviada', status, timestamp: '1754000000', recipient_id: '5511988887777' }]
    })));
    return ev;
  };

  test('mapeia sent, delivered, read e failed', () => {
    assert.equal(statusEvent('sent').type, EventTypes.MESSAGE_SENT);
    assert.equal(statusEvent('delivered').type, EventTypes.MESSAGE_DELIVERED);
    assert.equal(statusEvent('read').type, EventTypes.MESSAGE_READ);
    assert.equal(statusEvent('failed').type, EventTypes.MESSAGE_FAILED);
  });

  test('status desconhecido vira UNKNOWN em vez de quebrar', () => {
    // A Meta já introduziu status novos sem aviso; cair em UNKNOWN mantém o
    // evento rastreável pelo metadata em vez de derrubar o processamento.
    const ev = statusEvent('deleted');
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.equal(ev.metadata.status, 'deleted');
  });

  test('usa recipient_id como chatId e preserva janela de cobrança', () => {
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({
      statuses: [{
        id: 'wamid.x', status: 'delivered', timestamp: '1754000000',
        recipient_id: '5511988887777',
        conversation: { id: 'conv-1', origin: { type: 'marketing' } },
        pricing: { billable: true, category: 'marketing' }
      }]
    })));
    assert.equal(ev.chatId, '5511988887777');
    assert.equal(ev.messageId, 'wamid.x');
    assert.equal(ev.metadata.conversation.origin.type, 'marketing');
    assert.equal(ev.metadata.pricing.billable, true);
  });

  test('erros do status são preservados (diagnóstico de falha de entrega)', () => {
    const errors = [{ code: 131047, title: 'Re-engagement message' }];
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({
      statuses: [{ id: 'w1', status: 'failed', timestamp: '1754000000', recipient_id: '55119', errors }]
    })));
    assert.equal(ev.type, EventTypes.MESSAGE_FAILED);
    assert.deepEqual(ev.metadata.errors, errors);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — mensagens, status e erros no mesmo change', () => {
  test('emite os três, na ordem messages → statuses → errors', () => {
    const events = parseCloudApiWebhook(envelope('messages', messagesValue({
      messages: [textMessage()],
      statuses: [{ id: 'w1', status: 'read', timestamp: '1754000000', recipient_id: '55119' }],
      errors: [{ code: 130429, title: 'Rate limit hit' }]
    })));

    assert.equal(events.length, 3);
    assert.deepEqual(events.map(e => e.type), [
      EventTypes.MESSAGE_RECEIVED,
      EventTypes.MESSAGE_READ,
      EventTypes.MESSAGE_FAILED
    ]);
    assert.equal(events[2].metadata.error.code, 130429);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('parseCloudApiWebhook — template e conta', () => {
  test('aprovação de template vira TEMPLATE_STATUS_CHANGED', () => {
    const [ev] = parseCloudApiWebhook(envelope('message_template_status_update', {
      message_template_id: 123456,
      message_template_name: 'lembrete_renovacao',
      message_template_language: 'pt_BR',
      event: 'APPROVED',
      reason: 'NONE'
    }));

    assert.equal(ev.type, EventTypes.TEMPLATE_STATUS_CHANGED);
    // aqui o accountId é a WABA: template é da conta de negócio, não do número
    assert.equal(ev.accountId, WABA);
    assert.equal(ev.metadata.templateName, 'lembrete_renovacao');
    assert.equal(ev.metadata.newStatus, 'APPROVED');
    assert.equal(ev.metadata.templateLanguage, 'pt_BR');
  });

  test('rejeição carrega o motivo', () => {
    const [ev] = parseCloudApiWebhook(envelope('message_template_status_update', {
      message_template_name: 'promo', event: 'REJECTED', reason: 'INVALID_FORMAT'
    }));
    assert.equal(ev.metadata.newStatus, 'REJECTED');
    assert.equal(ev.metadata.reason, 'INVALID_FORMAT');
  });

  test('os quatro fields de conta viram ACCOUNT_STATUS_CHANGED', () => {
    for (const field of [
      'account_update', 'business_capability_update',
      'phone_number_quality_update', 'phone_number_name_update'
    ]) {
      const [ev] = parseCloudApiWebhook(envelope(field, {
        metadata: { phone_number_id: PHONE_ID }, event: 'VERIFIED'
      }));
      assert.equal(ev.type, EventTypes.ACCOUNT_STATUS_CHANGED, `field ${field}`);
      assert.equal(ev.metadata.originalEvent, field);
    }
  });

  test('field desconhecido vira UNKNOWN, preservando o nome original', () => {
    // Meta adiciona fields novos sem aviso — o app precisa poder inspecionar.
    const [ev] = parseCloudApiWebhook(envelope('flows', { some: 'payload' }));
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.equal(ev.metadata.originalEvent, 'flows');
    assert.equal(ev.accountId, WABA); // sem phone_number_id, cai para a WABA
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('validateCloudApiSignature', () => {
  const SECRET = 'app-secret-de-teste';
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const sign = (b, s = SECRET) => 'sha256=' + createHmac('sha256', s).update(b).digest('hex');

  test('aceita assinatura correta com body em string e em Buffer', () => {
    assert.equal(validateCloudApiSignature(body, sign(body), SECRET), true);
    const buf = Buffer.from(body, 'utf8');
    assert.equal(validateCloudApiSignature(buf, sign(buf), SECRET), true);
  });

  test('rejeita assinatura de outro segredo', () => {
    assert.equal(validateCloudApiSignature(body, sign(body, 'segredo-errado'), SECRET), false);
  });

  test('rejeita quando o corpo foi adulterado', () => {
    const assinatura = sign(body);
    assert.equal(validateCloudApiSignature(body + ' ', assinatura, SECRET), false);
  });

  test('rejeita header malformado', () => {
    for (const h of ['sha1=abc', 'abc', '', null, undefined, 123]) {
      assert.equal(validateCloudApiSignature(body, h, SECRET), false, `header ${h}`);
    }
  });

  test('rejeita hex fora do formato de 64 caracteres', () => {
    assert.equal(validateCloudApiSignature(body, 'sha256=xyz', SECRET), false);
    assert.equal(validateCloudApiSignature(body, 'sha256=' + 'a'.repeat(63), SECRET), false);
    assert.equal(validateCloudApiSignature(body, 'sha256=' + 'z'.repeat(64), SECRET), false);
  });

  test('rejeita corpo nulo', () => {
    assert.equal(validateCloudApiSignature(null, sign(body), SECRET), false);
    assert.equal(validateCloudApiSignature(undefined, sign(body), SECRET), false);
  });

  test('sem appSecret retorna true — conveniência de dev, documentada', () => {
    // Comportamento deliberado para ambiente local. Produção DEVE configurar o
    // segredo; se este teste mudar, é decisão de design, não bug.
    assert.equal(validateCloudApiSignature(body, 'qualquer-coisa', ''), true);
    assert.equal(validateCloudApiSignature(body, undefined, null), true);
  });

  test('aceita objeto já parseado como fallback (best-effort)', () => {
    const obj = { object: 'whatsapp_business_account', entry: [] };
    const assinatura = sign(JSON.stringify(obj));
    assert.equal(validateCloudApiSignature(obj, assinatura, SECRET), true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('generateWebhookJobId', () => {
  test('usa messageId quando existe — é o que garante dedup na fila', () => {
    const [ev] = parseCloudApiWebhook(envelope('messages', messagesValue({ messages: [textMessage({ id: 'wamid.abc' })] })));
    assert.equal(generateWebhookJobId(ev), `cloud-api:message.received:${PHONE_ID}:wamid.abc`);
  });

  test('cai para o timestamp quando não há messageId', () => {
    const [ev] = parseCloudApiWebhook(envelope('account_update', { metadata: { phone_number_id: PHONE_ID } }));
    assert.equal(generateWebhookJobId(ev), `cloud-api:account.status_changed:${PHONE_ID}:${ev.timestamp}`);
  });

  test('o mesmo evento sempre gera o mesmo id', () => {
    const payload = envelope('messages', messagesValue({ messages: [textMessage({ id: 'wamid.fixo' })] }));
    const [a] = parseCloudApiWebhook(payload);
    const [b] = parseCloudApiWebhook(payload);
    assert.equal(generateWebhookJobId(a), generateWebhookJobId(b));
  });
});
