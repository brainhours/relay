/**
 * Zernio — cartões (carrossel) na DM do Instagram / Messenger.
 *
 * Três coisas protegidas aqui:
 *
 *  - A VALIDAÇÃO LOCAL espelha os limites que a Zernio recusa com 400. Errar
 *    para menos corta conteúdo válido; errar para mais só adia a recusa para
 *    depois da fila, onde é mais caro descobrir.
 *
 *  - O ECO DO CARROSSEL CHEGA "VAZIO". Texto nulo, sem anexo, e os cartões no
 *    envelope ao lado de `message`. Quem lê só `content`/`attachments` descarta
 *    a mensagem — aconteceu em produção.
 *
 *  - O TOQUE NO BOTÃO é uma mensagem recebida comum; o que o distingue é o
 *    `postbackPayload` no envelope.
 *
 * Os payloads são os medidos em 21 e 23/11/2026, encurtados.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  CARD_LIMITS,
  ZernioCardsError,
  buildCardsTemplate,
  parseCards,
  cardsFromMessage
} = require('../src/providers/zernio/cards');
const { parseZernioWebhook } = require('../src/providers/zernio/webhooks');
const { ZernioMessagingManager } = require('../src/providers/zernio/messaging');
const { EventTypes } = require('../src/events/types');
const root = require('../src');

const metaInteractive = {
  template: {
    type: 'generic',
    elements: [
      {
        title: 'Plano Mensal',
        buttons: [
          { type: 'postback', title: 'Quero o Mensal', payload: 'CARD1_MENSAL' },
          { url: 'https://getraze.co', type: 'url', title: 'Ver detalhes' }
        ],
        imageUrl: 'https://cdn.exemplo.com/mensal.jpg',
        subtitle: '2 aulas por semana'
      },
      { title: 'Aula experimental', buttons: [{ url: 'https://getraze.co', type: 'url', title: 'Agendar' }] }
    ]
  }
};

const envelope = (event, message, extra = {}) => ({
  id: 'evt-1',
  event,
  timestamp: '2026-11-23T13:51:55.355Z',
  account: { accountId: 'acc-1', platform: 'instagram' },
  conversation: { id: 'conv-1', platformConversationId: '114588', participantId: '114588' },
  message: { id: 'msg-1', conversationId: 'conv-1', platform: 'instagram', attachments: [], ...message },
  ...extra
});

const codeOf = (fn) => {
  try { fn(); } catch (e) { assert.ok(e instanceof ZernioCardsError, e.message); return e.code; }
  return null;
};

// ───────────────────────────────────────────────────────────────────────────
describe('buildCardsTemplate', () => {
  test('monta o template genérico na forma que a Zernio aceita', () => {
    const tpl = buildCardsTemplate([
      {
        title: ' Plano Mensal ',
        subtitle: '2 aulas por semana',
        imageUrl: 'https://cdn.exemplo.com/mensal.jpg',
        buttons: [
          { type: 'postback', title: 'Quero o Mensal', payload: 'CARD1_MENSAL' },
          { type: 'url', title: 'Ver detalhes', url: 'https://getraze.co' }
        ]
      },
      { title: 'Aula experimental' }
    ]);
    assert.deepEqual(tpl, {
      type: 'generic',
      elements: [
        {
          title: 'Plano Mensal',
          subtitle: '2 aulas por semana',
          imageUrl: 'https://cdn.exemplo.com/mensal.jpg',
          buttons: [
            { type: 'postback', title: 'Quero o Mensal', payload: 'CARD1_MENSAL' },
            { type: 'url', title: 'Ver detalhes', url: 'https://getraze.co' }
          ]
        },
        { title: 'Aula experimental' }
      ]
    });
  });

  test('botão sem tipo: com url é link, sem url é resposta; payload cai para o título', () => {
    const [el] = buildCardsTemplate([{ title: 'x', buttons: [{ title: 'Abrir', url: 'https://a.co' }, { title: 'Quero' }] }]).elements;
    assert.deepEqual(el.buttons, [
      { type: 'url', title: 'Abrir', url: 'https://a.co' },
      { type: 'postback', title: 'Quero', payload: 'Quero' }
    ]);
  });

  test('os limites são os que a Zernio recusa', () => {
    assert.deepEqual({ ...CARD_LIMITS }, { MAX_CARDS: 10, MAX_BUTTONS: 3, TITLE: 80, SUBTITLE: 80, BUTTON_TITLE: 20 });
    const ok = (n) => 'a'.repeat(n);
    assert.equal(codeOf(() => buildCardsTemplate([{ title: ok(80), subtitle: ok(80), buttons: [{ title: ok(20) }] }])), null);
    assert.equal(codeOf(() => buildCardsTemplate([{ title: ok(81) }])), 'title_too_long');
    assert.equal(codeOf(() => buildCardsTemplate([{ title: 'x', subtitle: ok(81) }])), 'subtitle_too_long');
    assert.equal(codeOf(() => buildCardsTemplate([{ title: 'x', buttons: [{ title: ok(21) }] }])), 'button_title_too_long');
    assert.equal(codeOf(() => buildCardsTemplate([{ title: 'x', buttons: Array(4).fill({ title: 'b' }) }])), 'too_many_buttons');
    assert.equal(codeOf(() => buildCardsTemplate(Array(11).fill({ title: 'x' }))), 'too_many_cards');
    assert.equal(codeOf(() => buildCardsTemplate(Array(10).fill({ title: 'x' }))), null);
  });

  test('o que falta ou está errado tem código e caminho', () => {
    assert.equal(codeOf(() => buildCardsTemplate([])), 'cards_required');
    assert.equal(codeOf(() => buildCardsTemplate(null)), 'cards_required');
    assert.equal(codeOf(() => buildCardsTemplate([{ subtitle: 'sem título' }])), 'title_required');
    assert.equal(codeOf(() => buildCardsTemplate([{ title: 'x', imageUrl: 'arquivo.jpg' }])), 'image_url_invalid');
    assert.equal(codeOf(() => buildCardsTemplate([{ title: 'x', buttons: [{ url: 'https://a.co' }] }])), 'button_title_required');
    assert.equal(codeOf(() => buildCardsTemplate([{ title: 'x', buttons: [{ type: 'url', title: 'b' }] }])), 'button_url_invalid');
    assert.equal(codeOf(() => buildCardsTemplate([{ title: 'x', buttons: [{ type: 'call', title: 'b' }] }])), 'button_type_invalid');
    try { buildCardsTemplate([{ title: 'ok' }, { title: 'x', buttons: [{ title: 'a' }, { title: '' }] }]); assert.fail(); } catch (e) {
      assert.equal(e.path, 'cards[1].buttons[1]');
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('messaging.sendCards', () => {
  const fake = () => {
    const calls = [];
    return { calls, manager: new ZernioMessagingManager({ request: (r) => { calls.push(r); return Promise.resolve({ success: true }); } }) };
  };

  test('envia o template no endpoint de mensagens, sem texto nem botões no topo', async () => {
    const { calls, manager } = fake();
    await manager.sendCards({ conversationId: '114588', accountId: 'acc-1', cards: [{ title: 'Plano Mensal' }] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].path, '/inbox/conversations/114588/messages');
    assert.deepEqual(calls[0].data, { accountId: 'acc-1', template: { type: 'generic', elements: [{ title: 'Plano Mensal' }] } });
  });

  test('cartão inválido não chega à rede', () => {
    const { calls, manager } = fake();
    assert.throws(() => manager.sendCards({ conversationId: 'c', accountId: 'a', cards: [{ title: 'a'.repeat(81) }] }), ZernioCardsError);
    assert.throws(() => manager.sendCards({ accountId: 'a', cards: [{ title: 'x' }] }), /conversationId/);
    assert.throws(() => manager.sendCards({ conversationId: 'c', cards: [{ title: 'x' }] }), /accountId/);
    assert.equal(calls.length, 0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('webhook — eco do carrossel', () => {
  test('message.sent sem texto e sem anexo traz os cartões em metadata.cards', () => {
    const ev = parseZernioWebhook(envelope('message.sent', { direction: 'outgoing', text: null }, { metadata: { metaInteractive } }));
    assert.equal(ev.type, EventTypes.MESSAGE_SENT);
    assert.equal(ev.content, '');
    assert.deepEqual(ev.attachments, []);
    assert.equal(ev.metadata.cards.length, 2);
    assert.deepEqual(ev.metadata.cards[0], {
      title: 'Plano Mensal',
      subtitle: '2 aulas por semana',
      imageUrl: 'https://cdn.exemplo.com/mensal.jpg',
      buttons: [
        { type: 'postback', title: 'Quero o Mensal', payload: 'CARD1_MENSAL' },
        { type: 'url', title: 'Ver detalhes', url: 'https://getraze.co' }
      ]
    });
  });

  test('mensagem comum não ganha cards nem postback', () => {
    const ev = parseZernioWebhook(envelope('message.received', { direction: 'incoming', text: 'Oi' }));
    assert.equal('cards' in ev.metadata, false);
    assert.equal('postback' in ev.metadata, false);
  });

  test('leitura REST: os cartões vêm dentro da mensagem', () => {
    assert.equal(cardsFromMessage({ message: '', metadata: { sentVia: 'api', metaInteractive } }).length, 2);
    assert.equal(cardsFromMessage({ message: 'oi' }), null);
    assert.equal(parseCards({ template: { elements: [] } }), null);
    assert.equal(parseCards({ template: { elements: [{}, null] } }), null);
    assert.equal(parseCards(undefined), null);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('webhook — toque em botão de resposta', () => {
  test('message.received com postbackPayload expõe metadata.postback', () => {
    const ev = parseZernioWebhook(envelope(
      'message.received',
      { direction: 'incoming', text: 'Quero o Mensal', platformMessageId: 'postback_1795442609779_114588' },
      { metadata: { postbackPayload: 'CARD1_MENSAL', postbackTitle: 'Quero o Mensal' } }
    ));
    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(ev.content, 'Quero o Mensal');
    assert.deepEqual(ev.metadata.postback, { payload: 'CARD1_MENSAL', title: 'Quero o Mensal' });
  });

  test('sem título no envelope, o título é o texto da mensagem', () => {
    const ev = parseZernioWebhook(envelope('message.received', { text: 'Quero' }, { metadata: { postbackPayload: 'P' } }));
    assert.deepEqual(ev.metadata.postback, { payload: 'P', title: 'Quero' });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('exports', () => {
  test('a raiz do pacote expõe os cartões com prefixo', () => {
    assert.equal(root.buildZernioCardsTemplate, buildCardsTemplate);
    assert.equal(root.parseZernioCards, parseCards);
    assert.equal(root.zernioCardsFromMessage, cardsFromMessage);
    assert.equal(root.ZERNIO_CARD_LIMITS, CARD_LIMITS);
    assert.equal(root.ZernioCardsError, ZernioCardsError);
  });
});
