/**
 * Zernio — parser de webhook e validação de assinatura.
 *
 * O Zernio é o provider mais amplo do pacote: cobre 16 plataformas sociais e o
 * WhatsApp oficial, então o mesmo parser precisa devolver `providerType`
 * correto para LinkedIn, Instagram, TikTok, WhatsApp e por aí vai.
 *
 * A estrutura é um envelope `{ id, event, <entidade>, timestamp }`, e a
 * entidade muda conforme o evento: message, comment, review, post, template.
 * O roteamento é por FAMÍLIA (o prefixo antes do primeiro ponto), e a ordem
 * dos branches importa — `whatsapp.template.*` tem que ser tratado antes do
 * branch de conta, senão o de conta engole o evento e descarta os campos do
 * template. Há teste específico para isso.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const {
  parseZernioWebhook,
  validateZernioSignature,
  generateWebhookJobId,
  ZERNIO_EVENT_MAP,
  PLATFORM_TO_PROVIDER_TYPE
} = require('../src/providers/zernio/webhooks');
const { EventTypes, ProviderTypes } = require('../src/events/types');

const ACC = 'acc-zernio-1';
const env = (event, extra = {}) => ({
  id: 'evt-1',
  event,
  timestamp: '2026-08-03T12:00:00.000Z',
  account: { accountId: ACC, platform: 'instagram' },
  ...extra
});

// ───────────────────────────────────────────────────────────────────────────
describe('envelope', () => {
  test('sem `event` devolve null — é o contrato para payload não reconhecido', () => {
    assert.equal(parseZernioWebhook({ id: 'x' }), null);
    assert.equal(parseZernioWebhook({}), null);
    assert.equal(parseZernioWebhook(null), null);
    assert.equal(parseZernioWebhook(), null);
  });

  test('accountId aceita accountId, id ou o campo de topo', () => {
    assert.equal(parseZernioWebhook(env('post.published', { account: { accountId: 'A' } })).accountId, 'A');
    assert.equal(parseZernioWebhook(env('post.published', { account: { id: 'B' } })).accountId, 'B');
    assert.equal(parseZernioWebhook(env('post.published', { account: {}, accountId: 'C' })).accountId, 'C');
    assert.equal(parseZernioWebhook(env('post.published', { account: {} })).accountId, null);
  });

  test('usa o timestamp do payload; sem ele, cai para agora', () => {
    assert.equal(parseZernioWebhook(env('post.published')).timestamp, '2026-08-03T12:00:00.000Z');
    const semTs = parseZernioWebhook({ event: 'post.published', account: {} });
    assert.ok(!Number.isNaN(Date.parse(semTs.timestamp)));
  });

  test('guarda o payload inteiro em metadata.zernioEvent', () => {
    // É o que permite ao consumidor ramificar em eventos que caem em UNKNOWN.
    const p = env('algo.novo.da.zernio');
    const ev = parseZernioWebhook(p);
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.deepEqual(ev.metadata.zernioEvent, p);
    assert.equal(ev.metadata.eventId, 'evt-1');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('mapa de eventos', () => {
  test('eventos de mensagem', () => {
    const casos = {
      'message.received': EventTypes.MESSAGE_RECEIVED,
      'message.sent': EventTypes.MESSAGE_SENT,
      'message.delivered': EventTypes.MESSAGE_DELIVERED,
      'message.read': EventTypes.MESSAGE_READ,
      'message.edited': EventTypes.MESSAGE_EDITED,
      'message.deleted': EventTypes.MESSAGE_DELETED,
      'message.failed': EventTypes.MESSAGE_FAILED,
      'reaction.received': EventTypes.MESSAGE_REACTION
    };
    for (const [evento, esperado] of Object.entries(casos)) {
      assert.equal(parseZernioWebhook(env(evento, { message: {} })).type, esperado, evento);
    }
  });

  test('conta e números de WhatsApp', () => {
    assert.equal(parseZernioWebhook(env('account.connected')).type, EventTypes.ACCOUNT_CONNECTED);
    assert.equal(parseZernioWebhook(env('account.disconnected')).type, EventTypes.ACCOUNT_DISCONNECTED);
    assert.equal(parseZernioWebhook(env('whatsapp.number.released')).type, EventTypes.ACCOUNT_DISCONNECTED);
    for (const e of ['activated', 'declined', 'action_required', 'verification_required', 'suspended', 'reactivated', 'kyc_submitted']) {
      assert.equal(parseZernioWebhook(env(`whatsapp.number.${e}`)).type, EventTypes.ACCOUNT_STATUS_CHANGED, e);
    }
  });

  test('evento fora do mapa vira UNKNOWN sem perder o nome', () => {
    const ev = parseZernioWebhook(env('ad.budget_exceeded'));
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.equal(ev.metadata.zernioEvent.event, 'ad.budget_exceeded');
  });

  test('o mapa é congelado (não dá para mutar em runtime)', () => {
    // Em CommonJS não-strict a atribuição a objeto congelado falha em silêncio,
    // sem lançar — então o que se verifica é o efeito, não a exceção.
    ZERNIO_EVENT_MAP['evento.injetado'] = EventTypes.MESSAGE_RECEIVED;
    assert.equal(ZERNIO_EVENT_MAP['evento.injetado'], undefined);
    assert.ok(Object.isFrozen(ZERNIO_EVENT_MAP));
    assert.ok(Object.isFrozen(PLATFORM_TO_PROVIDER_TYPE));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('mapeamento de plataforma', () => {
  test('as 16 plataformas conhecidas viram ProviderTypes', () => {
    for (const [slug, esperado] of Object.entries(PLATFORM_TO_PROVIDER_TYPE)) {
      const ev = parseZernioWebhook(env('message.received', {
        message: { platform: slug, text: 'x' }
      }));
      assert.equal(ev.providerType, esperado, slug);
    }
  });

  test('slug é case-insensitive', () => {
    const ev = parseZernioWebhook(env('message.received', { message: { platform: 'InStAgRaM' } }));
    assert.equal(ev.providerType, ProviderTypes.INSTAGRAM);
  });

  test('plataforma nova cai para o slug em MAIÚSCULA em vez de sumir', () => {
    // Zernio adiciona canal antes do relay conhecer: melhor propagar o nome do
    // que devolver undefined e o consumidor perder de onde veio a mensagem.
    const ev = parseZernioWebhook(env('message.received', { message: { platform: 'mastodon' } }));
    assert.equal(ev.providerType, 'MASTODON');
  });

  test('precedência: message.platform > conversation.platform > account.platform', () => {
    const ev = parseZernioWebhook(env('message.received', {
      message: { platform: 'linkedin' },
      conversation: { platform: 'facebook' },
      account: { accountId: ACC, platform: 'tiktok' }
    }));
    assert.equal(ev.providerType, ProviderTypes.LINKEDIN);

    const semMsg = parseZernioWebhook(env('message.received', {
      message: {}, conversation: { platform: 'facebook' },
      account: { accountId: ACC, platform: 'tiktok' }
    }));
    assert.equal(semMsg.providerType, ProviderTypes.FACEBOOK);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('mensagens', () => {
  test('mapeia o contrato', () => {
    const ev = parseZernioWebhook(env('message.received', {
      message: {
        id: 'msg-1', platformMessageId: 'ig-123', conversationId: 'conv-1',
        text: 'Oi!', direction: 'inbound', isRead: false, platform: 'instagram',
        sender: { id: 'user-9', name: 'Joana', username: 'joana_' }
      }
    }));

    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(ev.provider, 'zernio');
    assert.equal(ev.providerType, ProviderTypes.INSTAGRAM);
    assert.equal(ev.chatId, 'conv-1');
    assert.equal(ev.messageId, 'msg-1');
    assert.equal(ev.senderId, 'user-9');
    assert.equal(ev.senderName, 'Joana');
    assert.equal(ev.content, 'Oi!');
    assert.equal(ev.metadata.direction, 'inbound');
    assert.equal(ev.metadata.platformMessageId, 'ig-123');
  });

  test('cai para username quando não há nome', () => {
    const ev = parseZernioWebhook(env('message.received', {
      message: { sender: { id: 'u1', username: 'so_username' } }
    }));
    assert.equal(ev.senderName, 'so_username');
  });

  test('messageId cai para platformMessageId', () => {
    const ev = parseZernioWebhook(env('message.received', { message: { platformMessageId: 'plat-1' } }));
    assert.equal(ev.messageId, 'plat-1');
  });

  test('chatId cai para conversation.id', () => {
    const ev = parseZernioWebhook(env('message.received', { message: {}, conversation: { id: 'c-9' } }));
    assert.equal(ev.chatId, 'c-9');
  });

  test('conteúdo aceita text ou message', () => {
    assert.equal(parseZernioWebhook(env('message.received', { message: { text: 'A' } })).content, 'A');
    assert.equal(parseZernioWebhook(env('message.received', { message: { message: 'B' } })).content, 'B');
    assert.equal(parseZernioWebhook(env('message.received', { message: {} })).content, '');
  });

  test('dados de WhatsApp do remetente ficam no metadata', () => {
    const ev = parseZernioWebhook(env('message.received', {
      message: { sender: { id: 'u', phoneNumber: '5511999999999', businessScopedUserId: 'bsid-1', contactId: 'ct-1' } }
    }));
    assert.equal(ev.metadata.phoneNumber, '5511999999999');
    assert.equal(ev.metadata.businessScopedUserId, 'bsid-1');
    assert.equal(ev.metadata.contactId, 'ct-1');
  });

  test('reaction usa a mesma rota de mensagem', () => {
    const ev = parseZernioWebhook(env('reaction.received', {
      reaction: { id: 'r-1', text: '👍', sender: { id: 'u1' } }
    }));
    assert.equal(ev.type, EventTypes.MESSAGE_REACTION);
    assert.equal(ev.messageId, 'r-1');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('anexos', () => {
  const attOf = (attachments) =>
    parseZernioWebhook(env('message.received', { message: { attachments } })).attachments;

  test('preserva type e originalType — distinguem mídia de post compartilhado', () => {
    // `type` é a categoria (image/video); `originalType` diz se é um ig_reel
    // compartilhado, que é permalink e NÃO se baixa como arquivo.
    const att = attOf([{ url: 'https://cdn/r.mp4', type: 'video', originalType: 'ig_reel', id: 'a1' }]);
    assert.equal(att.length, 1);
    assert.equal(att[0].type, 'video');
    assert.equal(att[0].originalType, 'ig_reel');
  });

  test('payload do share é preservado (título/url do post citado)', () => {
    const payload = { title: 'Meu reel', url: 'https://instagram.com/p/x' };
    assert.deepEqual(attOf([{ url: 'https://cdn/x', payload }])[0].payload, payload);
  });

  test('anexo sem url é descartado', () => {
    assert.deepEqual(attOf([{ type: 'image' }, null, undefined]), []);
  });

  test('não sendo array, devolve vazio', () => {
    assert.deepEqual(attOf(undefined), []);
    assert.deepEqual(attOf('nao-e-array'), []);
  });

  test('mimeType cai para type quando ausente', () => {
    assert.equal(attOf([{ url: 'https://cdn/x', type: 'image' }])[0].mimeType, 'image');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('template de WhatsApp — precedência sobre o branch de conta', () => {
  test('whatsapp.template.status_updated não é engolido pelo branch de conta', () => {
    // Regressão da 1.23.0: o evento caía no branch genérico de account (que só
    // lê `account.*`) e templateId/newStatus/reason nunca eram extraídos,
    // inviabilizando o tracking de aprovação.
    const ev = parseZernioWebhook(env('whatsapp.template.status_updated', {
      template: { id: 'tpl-1', name: 'boas_vindas', status: 'APPROVED', category: 'MARKETING', language: 'pt_BR' }
    }));
    assert.equal(ev.type, EventTypes.TEMPLATE_STATUS_CHANGED);
    assert.equal(ev.providerType, ProviderTypes.WHATSAPP);
    assert.equal(ev.metadata.templateId, 'tpl-1');
    assert.equal(ev.metadata.templateName, 'boas_vindas');
    assert.equal(ev.metadata.newStatus, 'APPROVED');
    assert.equal(ev.metadata.language, 'pt_BR');
  });

  test('tolera variações de nome de campo entre versões', () => {
    const ev = parseZernioWebhook(env('whatsapp.template.status_updated', {
      template: { _id: 'alt-id', templateName: 'nome_alt', newStatus: 'REJECTED', rejectionReason: 'INVALID', languageCode: 'en_US' }
    }));
    assert.equal(ev.metadata.templateId, 'alt-id');
    assert.equal(ev.metadata.templateName, 'nome_alt');
    assert.equal(ev.metadata.newStatus, 'REJECTED');
    assert.equal(ev.metadata.reason, 'INVALID');
    assert.equal(ev.metadata.language, 'en_US');
  });

  test('aceita a entidade em template, whatsapp.template ou data', () => {
    const esperado = 'tpl-x';
    for (const corpo of [
      { template: { id: esperado } },
      { whatsapp: { template: { id: esperado } } },
      { data: { id: esperado } }
    ]) {
      const ev = parseZernioWebhook(env('whatsapp.template.status_updated', corpo));
      assert.equal(ev.metadata.templateId, esperado);
    }
  });

  test('metaTemplateId é exposto à parte, para quem casa pelo id da Meta', () => {
    const ev = parseZernioWebhook(env('whatsapp.template.status_updated', {
      template: { id: 'interno', metaTemplateId: '99887766' }
    }));
    assert.equal(ev.metadata.templateId, 'interno');
    assert.equal(ev.metadata.metaTemplateId, '99887766');
  });

  test('whatsapp.number.* continua no branch de conta', () => {
    const ev = parseZernioWebhook(env('whatsapp.number.activated', {
      account: { accountId: ACC, platform: 'whatsapp', displayName: 'Acme' }
    }));
    assert.equal(ev.type, EventTypes.ACCOUNT_STATUS_CHANGED);
    assert.equal(ev.senderName, 'Acme');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('comentários (funis comentário→DM)', () => {
  test('mapeia autor e post-alvo', () => {
    const ev = parseZernioWebhook(env('comment.received', {
      comment: { id: 'c-1', text: 'Quero saber mais', parentId: null, platform: 'instagram', author: { id: 'a-1', name: 'Ana', username: 'ana_' } },
      post: { id: 'p-1', platformPostId: 'IGmedia-999' }
    }));

    assert.equal(ev.type, EventTypes.COMMENT_RECEIVED);
    assert.equal(ev.providerType, ProviderTypes.INSTAGRAM);
    assert.equal(ev.chatId, 'p-1');
    assert.equal(ev.messageId, 'c-1');
    assert.equal(ev.senderId, 'a-1');
    assert.equal(ev.senderName, 'Ana');
    assert.equal(ev.content, 'Quero saber mais');
    assert.equal(ev.metadata.authorUsername, 'ana_');
  });

  test('platformPostId é o que casa o comentário com o post da automação', () => {
    // O id interno do post não serve: a automação é configurada contra o id de
    // mídia da plataforma. Os três nomes possíveis são aceitos.
    for (const campo of ['platformPostId', 'platformId', 'mediaId']) {
      const ev = parseZernioWebhook(env('comment.received', {
        comment: { id: 'c' }, post: { id: 'p', [campo]: 'MEDIA-1' }
      }));
      assert.equal(ev.metadata.platformPostId, 'MEDIA-1', campo);
    }
    const semPlat = parseZernioWebhook(env('comment.received', { comment: { id: 'c' }, post: { id: 'p' } }));
    assert.equal(semPlat.metadata.platformPostId, null);
  });

  test('senderId e senderName caem para username', () => {
    const ev = parseZernioWebhook(env('comment.received', {
      comment: { id: 'c', author: { username: 'so_user' } }, post: {}
    }));
    assert.equal(ev.senderId, 'so_user');
    assert.equal(ev.senderName, 'so_user');
  });

  test('resposta a comentário preserva o parentId', () => {
    const ev = parseZernioWebhook(env('comment.received', {
      comment: { id: 'c-2', parentId: 'c-1' }, post: { id: 'p' }
    }));
    assert.equal(ev.metadata.parentId, 'c-1');
  });

  test('plataforma vem do comentário, do post ou da conta, nessa ordem', () => {
    const doPost = parseZernioWebhook(env('comment.received', {
      comment: { id: 'c' }, post: { platform: 'facebook' },
      account: { accountId: ACC, platform: 'tiktok' }
    }));
    assert.equal(doPost.providerType, ProviderTypes.FACEBOOK);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('avaliações e posts', () => {
  test('review traz nota e autor', () => {
    const ev = parseZernioWebhook(env('review.received', {
      review: { id: 'rev-1', rating: 5, text: 'Ótimo!', platform: 'googlebusiness', reviewer: { name: 'Carlos' } }
    }));
    assert.equal(ev.providerType, ProviderTypes.GOOGLEBUSINESS);
    assert.equal(ev.messageId, 'rev-1');
    assert.equal(ev.senderName, 'Carlos');
    assert.equal(ev.content, 'Ótimo!');
    assert.equal(ev.metadata.rating, 5);
  });

  test('post cai no branch final e preserva status e plataformas', () => {
    const ev = parseZernioWebhook(env('post.published', {
      post: { id: 'p-1', content: 'Novidade!', status: 'published', platforms: [{ platform: 'linkedin' }] }
    }));
    assert.equal(ev.messageId, 'p-1');
    assert.equal(ev.content, 'Novidade!');
    assert.equal(ev.metadata.status, 'published');
    assert.equal(ev.providerType, ProviderTypes.LINKEDIN);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('validateZernioSignature', () => {
  const SECRET = 'segredo-zernio';
  const body = JSON.stringify({ event: 'message.received' });
  const hex = (b, s = SECRET) => createHmac('sha256', s).update(b).digest('hex');

  test('aceita hex puro e com prefixo sha256=', () => {
    assert.equal(validateZernioSignature(body, hex(body), SECRET), true);
    assert.equal(validateZernioSignature(body, 'sha256=' + hex(body), SECRET), true);
  });

  test('aceita Buffer', () => {
    const buf = Buffer.from(body, 'utf-8');
    assert.equal(validateZernioSignature(buf, hex(buf), SECRET), true);
  });

  test('rejeita segredo errado e corpo adulterado', () => {
    assert.equal(validateZernioSignature(body, hex(body, 'outro'), SECRET), false);
    assert.equal(validateZernioSignature(body + 'x', hex(body), SECRET), false);
  });

  test('rejeita header vazio ou não-string', () => {
    for (const h of ['', null, undefined, 123, {}]) {
      assert.equal(validateZernioSignature(body, h, SECRET), false, String(h));
    }
  });

  test('rejeita assinatura de tamanho diferente sem lançar', () => {
    assert.equal(validateZernioSignature(body, 'abc', SECRET), false);
  });

  test('sem secret retorna true — conveniência de dev, deliberada', () => {
    assert.equal(validateZernioSignature(body, 'qualquer', ''), true);
    assert.equal(validateZernioSignature(body, undefined, null), true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('generateWebhookJobId', () => {
  test('prioriza o eventId do envelope — é o id único da entrega', () => {
    const ev = parseZernioWebhook(env('message.received', { message: { id: 'm-1' } }));
    assert.equal(generateWebhookJobId(ev), `zernio:message.received:${ACC}:evt-1`);
  });

  test('sem eventId, cai para messageId e depois timestamp', () => {
    const semId = parseZernioWebhook({
      event: 'message.received', account: { accountId: ACC },
      message: { id: 'm-9' }, timestamp: '2026-08-03T12:00:00.000Z'
    });
    assert.equal(generateWebhookJobId(semId), `zernio:message.received:${ACC}:m-9`);
  });
});
