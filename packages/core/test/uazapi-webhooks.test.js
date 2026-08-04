/**
 * Uazapi — parser de webhook (dois formatos de servidor).
 *
 * Este é o parser mais complexo do pacote, e a razão é histórica: o produto
 * hospedado migrou de um schema para outro sem quebrar quem já estava no
 * antigo. Então `parseUazapiWebhook` precisa aceitar os dois e devolver a
 * MESMA forma:
 *
 *   clássico v2.1  { event, instance, data }
 *   uazapiGO       { BaseUrl, EventType, token, owner, instanceName, ... }
 *
 * A detecção é por chave de topo: só o uazapiGO manda `BaseUrl` + `EventType`.
 * Errar essa detecção manda o payload para o parser errado e o evento sai
 * inteiro vazio — por isso os testes de detecção vêm primeiro.
 *
 * Outro ponto sensível: o canal `messages_update` é um guarda-chuva. Read,
 * delivered, editada, apagada e reação chegam todos por ele, e o tipo real só
 * se resolve olhando campos do payload.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseUazapiWebhook,
  validateUazapiSignature,
  generateWebhookJobId,
  UAZAPI_EVENT_MAP
} = require('../src/providers/uazapi/webhooks');
const { EventTypes, ProviderTypes } = require('../src/events/types');

const TOKEN = 'tok-instancia-123';

/** Envelope uazapiGO — precisa de BaseUrl + EventType para ser detectado. */
const go = (EventType, extra = {}) => ({
  BaseUrl: 'https://free.uazapi.com',
  EventType,
  token: TOKEN,
  owner: '5511999999999',
  instanceName: 'acme-suporte',
  ...extra
});

/** Envelope clássico v2.1. */
const classic = (event, data = {}, extra = {}) => ({
  event,
  instance: 'instancia-acme',
  data,
  ...extra
});

// ───────────────────────────────────────────────────────────────────────────
describe('detecção de formato', () => {
  test('BaseUrl + EventType juntos → uazapiGO', () => {
    const ev = parseUazapiWebhook(go('messages', { message: { text: 'oi' } }));
    assert.equal(ev.metadata.schema, 'uazapiGO');
  });

  test('sem BaseUrl/EventType → clássico', () => {
    const ev = parseUazapiWebhook(classic('messages', { text: 'oi' }));
    assert.equal(ev.metadata.schema, 'classic');
  });

  test('apenas uma das duas chaves não basta — cai no clássico', () => {
    // Meia-detecção mandaria o payload para o parser errado e devolveria um
    // evento vazio, sem erro nenhum — o pior tipo de falha.
    assert.equal(parseUazapiWebhook({ BaseUrl: 'https://x', event: 'messages', data: {} }).metadata.schema, 'classic');
    assert.equal(parseUazapiWebhook({ EventType: 'messages', event: 'messages', data: {} }).metadata.schema, 'classic');
  });

  test('payload vazio ou sem argumento não quebra', () => {
    for (const p of [{}, undefined, null]) {
      const ev = parseUazapiWebhook(p);
      assert.equal(ev.provider, 'uazapi');
      assert.equal(ev.type, EventTypes.UNKNOWN);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('clássico v2.1 — mensagens', () => {
  test('mensagem recebida mapeia o contrato', () => {
    const ev = parseUazapiWebhook(classic('messages', {
      chatid: '5511988887777@s.whatsapp.net',
      messageid: 'MSG-1',
      sender: '5511988887777@s.whatsapp.net',
      senderName: 'Joana',
      text: 'Bom dia',
      messageTimestamp: 1754000000,
      messageType: 'conversation'
    }));

    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(ev.provider, 'uazapi');
    assert.equal(ev.providerType, ProviderTypes.WHATSAPP);
    assert.equal(ev.accountId, 'instancia-acme');
    assert.equal(ev.chatId, '5511988887777@s.whatsapp.net');
    assert.equal(ev.messageId, 'MSG-1');
    assert.equal(ev.senderName, 'Joana');
    assert.equal(ev.content, 'Bom dia');
    // senderShort tira o sufixo do JID — é o que casa com telefone no banco
    assert.equal(ev.metadata.senderShort, '5511988887777');
  });

  test('fromMe distingue enviada de recebida', () => {
    assert.equal(parseUazapiWebhook(classic('messages', { text: 'x', fromMe: true })).type, EventTypes.MESSAGE_SENT);
    assert.equal(parseUazapiWebhook(classic('messages', { text: 'x', fromMe: false })).type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(parseUazapiWebhook(classic('messages', { text: 'x' })).type, EventTypes.MESSAGE_RECEIVED);
  });

  test('aceita os apelidos de cada campo', () => {
    const ev = parseUazapiWebhook(classic('messages', {
      chat_id: 'chat-alt', msgId: 'msg-alt', from: 'sender-alt', pushName: 'Push'
    }));
    assert.equal(ev.chatId, 'chat-alt');
    assert.equal(ev.messageId, 'msg-alt');
    assert.equal(ev.senderId, 'sender-alt');
    assert.equal(ev.senderName, 'Push');
  });

  test('precedência dos nomes: senderName > pushName > notifyName > contactName', () => {
    const nomes = { senderName: 'A', pushName: 'B', notifyName: 'C', contactName: 'D' };
    assert.equal(parseUazapiWebhook(classic('messages', nomes)).senderName, 'A');
    delete nomes.senderName;
    assert.equal(parseUazapiWebhook(classic('messages', nomes)).senderName, 'B');
    delete nomes.pushName;
    assert.equal(parseUazapiWebhook(classic('messages', nomes)).senderName, 'C');
    delete nomes.notifyName;
    assert.equal(parseUazapiWebhook(classic('messages', nomes)).senderName, 'D');
  });

  test('enquete usa `vote` quando não há texto', () => {
    assert.equal(parseUazapiWebhook(classic('messages', { vote: 'Opção 2' })).content, 'Opção 2');
  });

  test('texto vazio permanece vazio (não cai para vote)', () => {
    // `??` só pula null/undefined — string vazia é valor legítimo.
    assert.equal(parseUazapiWebhook(classic('messages', { text: '', vote: 'V' })).content, '');
  });

  test('accountId vem de instance, com fallback para data.owner', () => {
    assert.equal(parseUazapiWebhook({ event: 'messages', data: { owner: 'dono-1' } }).accountId, 'dono-1');
    assert.equal(parseUazapiWebhook({ event: 'messages', data: { instance: 'inst-2' } }).accountId, 'inst-2');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('clássico v2.1 — messages_update (canal guarda-chuva)', () => {
  const upd = (data) => parseUazapiWebhook(classic('messages_update', data)).type;

  test('reação tem precedência sobre os demais', () => {
    assert.equal(upd({ reaction: '👍', status: 'Read' }), EventTypes.MESSAGE_REACTION);
  });

  test('editada vem antes de apagada e de status', () => {
    assert.equal(upd({ edited: true, status: 'Read' }), EventTypes.MESSAGE_EDITED);
  });

  test('apagada por flag ou por status', () => {
    assert.equal(upd({ deleted: true }), EventTypes.MESSAGE_DELETED);
    assert.equal(upd({ status: 'Deleted' }), EventTypes.MESSAGE_DELETED);
  });

  test('Read e Delivered', () => {
    assert.equal(upd({ status: 'Read' }), EventTypes.MESSAGE_READ);
    assert.equal(upd({ status: 'Delivered' }), EventTypes.MESSAGE_DELIVERED);
  });

  test('status desconhecido ou ausente → UNKNOWN', () => {
    assert.equal(upd({ status: 'Pending' }), EventTypes.UNKNOWN);
    assert.equal(upd({}), EventTypes.UNKNOWN);
  });

  test('o status é sensível a maiúsculas — "read" minúsculo não casa', () => {
    // Documenta o comportamento atual: o parser clássico compara com
    // 'Read'/'Delivered' exatos. Se o servidor mudar a caixa, cai em UNKNOWN.
    assert.equal(upd({ status: 'read' }), EventTypes.UNKNOWN);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('clássico v2.1 — conexão e demais canais', () => {
  test('connected booleano decide conectado/desconectado', () => {
    assert.equal(parseUazapiWebhook(classic('connection', { connected: true })).type, EventTypes.ACCOUNT_CONNECTED);
    assert.equal(parseUazapiWebhook(classic('connection', { connected: false })).type, EventTypes.ACCOUNT_DISCONNECTED);
  });

  test('sem o booleano vira mudança de status genérica', () => {
    assert.equal(parseUazapiWebhook(classic('connection', {})).type, EventTypes.ACCOUNT_STATUS_CHANGED);
  });

  test('motivo da desconexão é preservado para diagnóstico', () => {
    const ev = parseUazapiWebhook(classic('connection', {
      connected: false, lastDisconnect: '2026-08-03T10:00:00Z', lastDisconnectReason: 'logged_out'
    }));
    assert.equal(ev.metadata.lastDisconnectReason, 'logged_out');
    assert.equal(ev.metadata.connected, false);
  });

  test('contacts é o mais próximo de RELATION_CREATED na taxonomia atual', () => {
    assert.equal(parseUazapiWebhook(classic('contacts', {})).type, EventTypes.RELATION_CREATED);
  });

  test('canais sem equivalente viram UNKNOWN mas guardam o nome original', () => {
    for (const canal of ['presence', 'groups', 'chats', 'call', 'labels', 'blocks', 'history']) {
      const ev = parseUazapiWebhook(classic(canal, {}));
      assert.equal(ev.type, EventTypes.UNKNOWN, canal);
      assert.equal(ev.metadata.originalEvent, canal);
    }
  });

  test('canal inexistente no mapa não quebra', () => {
    const ev = parseUazapiWebhook(classic('canal_que_nao_existe', {}));
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.equal(ev.metadata.originalEvent, 'canal_que_nao_existe');
  });

  test('o mapa exportado cobre os canais documentados', () => {
    for (const canal of ['messages', 'messages_update', 'connection', 'contacts']) {
      assert.ok(canal in UAZAPI_EVENT_MAP, canal);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('clássico v2.1 — anexos', () => {
  const attOf = (content) => parseUazapiWebhook(classic('messages', { content })).attachments;

  test('extrai mídia de content como objeto', () => {
    const att = attOf({ imageMessage: { url: 'https://cdn/x.jpg', mimetype: 'image/jpeg', fileLength: 1234, mediaKey: 'k1' } });
    assert.equal(att.length, 1);
    assert.equal(att[0].url, 'https://cdn/x.jpg');
    assert.equal(att[0].mimeType, 'image/jpeg');
    assert.equal(att[0].size, 1234);
  });

  test('extrai mídia de content como string JSON', () => {
    // O Uazapi às vezes serializa o content; sem o parse, todo anexo sumiria.
    const att = attOf(JSON.stringify({ documentMessage: { url: 'https://cdn/a.pdf', fileName: 'nota.pdf', mimetype: 'application/pdf' } }));
    assert.equal(att.length, 1);
    assert.equal(att[0].filename, 'nota.pdf');
  });

  test('string JSON inválida não quebra — só devolve vazio', () => {
    assert.deepEqual(attOf('{quebrado'), []);
    assert.deepEqual(attOf('texto solto'), []);
  });

  test('sem content, ou content sem mídia, resulta em array vazio', () => {
    assert.deepEqual(attOf(undefined), []);
    assert.deepEqual(attOf({ conversation: 'só texto' }), []);
  });

  test('mídia sem url e sem mediaKey é ignorada (não dá para baixar)', () => {
    assert.deepEqual(attOf({ imageMessage: { mimetype: 'image/png' } }), []);
  });

  test('aceita os nomes alternativos de url', () => {
    for (const campo of ['url', 'directPath', 'fileUrl', 'mediaUrl']) {
      const att = attOf({ videoMessage: { [campo]: 'https://cdn/v.mp4' } });
      assert.equal(att.length, 1, campo);
      assert.equal(att[0].url, 'https://cdn/v.mp4');
    }
  });

  test('cobre os cinco tipos aninhados de mídia do WhatsApp', () => {
    for (const k of ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'stickerMessage']) {
      assert.equal(attOf({ [k]: { url: 'https://cdn/f' } }).length, 1, k);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('uazapiGO — mensagens', () => {
  test('mapeia o contrato e encurta os JIDs', () => {
    const ev = parseUazapiWebhook(go('messages', {
      message: {
        id: 'GO-1', Chat: '5511988887777@s.whatsapp.net',
        Sender: '5511988887777@s.whatsapp.net', text: 'Olá do GO',
        messageTimestamp: 1754000000, Type: 'text'
      },
      chat: { wa_chatid: '5511988887777@s.whatsapp.net', wa_contactName: 'Joana GO' }
    }));

    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(ev.accountId, TOKEN);           // no GO o accountId é o token
    assert.equal(ev.chatId, '5511988887777');    // encurtado, diferente do clássico
    assert.equal(ev.senderId, '5511988887777');
    assert.equal(ev.senderName, 'Joana GO');
    assert.equal(ev.content, 'Olá do GO');
    assert.equal(ev.metadata.ownerPhone, '5511999999999');
    assert.equal(ev.metadata.instanceName, 'acme-suporte');
  });

  test('fromMe é lido de IsFromMe, fromMe ou key.fromMe', () => {
    for (const m of [{ IsFromMe: true }, { fromMe: true }, { key: { fromMe: true } }]) {
      assert.equal(parseUazapiWebhook(go('messages', { message: m })).type, EventTypes.MESSAGE_SENT);
    }
    assert.equal(parseUazapiWebhook(go('messages', { message: {} })).type, EventTypes.MESSAGE_RECEIVED);
  });

  test('conteúdo tem cadeia longa de fallback entre versões do servidor', () => {
    const campos = ['text', 'Text', 'body', 'Body', 'conversation', 'Conversation', 'caption', 'Caption'];
    for (const c of campos) {
      assert.equal(parseUazapiWebhook(go('messages', { message: { [c]: `via-${c}` } })).content, `via-${c}`, c);
    }
  });

  test('cai para o último texto do chat quando a mensagem não traz conteúdo', () => {
    assert.equal(
      parseUazapiWebhook(go('messages', { message: {}, chat: { lastMessageText: 'do chat' } })).content,
      'do chat'
    );
  });

  test('nome salvo tem precedência sobre push name', () => {
    // lead_fullName > lead_name > wa_contactName > wa_name > name > pushName
    const ev = parseUazapiWebhook(go('messages', {
      message: { pushName: 'Como se autodenomina' },
      chat: { lead_fullName: 'Nome no CRM', wa_contactName: 'Na agenda' }
    }));
    assert.equal(ev.senderName, 'Nome no CRM');
  });

  test('usa pushName quando o chat não tem nome salvo', () => {
    assert.equal(
      parseUazapiWebhook(go('messages', { message: { pushName: 'Fulano' }, chat: {} })).senderName,
      'Fulano'
    );
  });

  test('messageId aceita as variações de caixa entre versões', () => {
    for (const k of ['id', 'Id', 'ID', 'MessageID', 'messageid']) {
      assert.equal(parseUazapiWebhook(go('messages', { message: { [k]: 'M-1' } })).messageId, 'M-1', k);
    }
    assert.equal(parseUazapiWebhook(go('messages', { message: { key: { id: 'M-key' } } })).messageId, 'M-key');
  });

  test('grupo é sinalizado por wa_isGroup ou IsGroup', () => {
    assert.equal(parseUazapiWebhook(go('messages', { message: {}, chat: { wa_isGroup: true } })).metadata.isGroup, true);
    assert.equal(parseUazapiWebhook(go('messages', { message: { IsGroup: true } })).metadata.isGroup, true);
    assert.equal(parseUazapiWebhook(go('messages', { message: {} })).metadata.isGroup, false);
  });

  test('anexos: objeto de mídia e mediaUrl solto na mensagem', () => {
    const comObjeto = parseUazapiWebhook(go('messages', {
      message: { image: { url: 'https://cdn/i.jpg', mimetype: 'image/jpeg' } }
    }));
    assert.equal(comObjeto.attachments.length, 1);
    assert.equal(comObjeto.attachments[0].url, 'https://cdn/i.jpg');

    const inline = parseUazapiWebhook(go('messages', {
      message: { id: 'M', mediaUrl: 'https://cdn/solto.ogg', mimetype: 'audio/ogg' }
    }));
    assert.equal(inline.attachments.length, 1);
    assert.equal(inline.attachments[0].url, 'https://cdn/solto.ogg');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('uazapiGO — messages_update', () => {
  const upd = (body) => parseUazapiWebhook(go('messages_update', body));

  test('estados mapeiam para os tipos certos', () => {
    assert.equal(upd({ state: 'Read' }).type, EventTypes.MESSAGE_READ);
    assert.equal(upd({ state: 'Delivered' }).type, EventTypes.MESSAGE_DELIVERED);
    assert.equal(upd({ state: 'delivery' }).type, EventTypes.MESSAGE_DELIVERED);
    assert.equal(upd({ state: 'Played' }).type, EventTypes.MESSAGE_READ);
    assert.equal(upd({ state: 'Sent' }).type, EventTypes.MESSAGE_SENT);
    assert.equal(upd({ state: 'Failed' }).type, EventTypes.MESSAGE_FAILED);
    assert.equal(upd({ state: 'error' }).type, EventTypes.MESSAGE_FAILED);
    assert.equal(upd({ state: 'Deleted' }).type, EventTypes.MESSAGE_DELETED);
    assert.equal(upd({ state: 'Edited' }).type, EventTypes.MESSAGE_EDITED);
  });

  test('aqui o estado é case-insensitive (diferente do clássico)', () => {
    assert.equal(upd({ state: 'READ' }).type, EventTypes.MESSAGE_READ);
    assert.equal(upd({ state: 'read' }).type, EventTypes.MESSAGE_READ);
  });

  test('sem state, usa o Type do evento', () => {
    assert.equal(upd({ event: { Type: 'Read' } }).type, EventTypes.MESSAGE_READ);
  });

  test('áudio ouvido conta como leitura', () => {
    // 'played' é o recibo de áudio; tratar como READ evita um tipo novo só
    // para isso e é o que o consumidor espera ver na conversa.
    assert.equal(upd({ state: 'played' }).type, EventTypes.MESSAGE_READ);
  });

  test('estado desconhecido → UNKNOWN, com o estado preservado', () => {
    const ev = upd({ state: 'algo_novo' });
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.equal(ev.metadata.state, 'algo_novo');
  });

  test('um recibo cobre várias mensagens: a primeira é canônica, a lista fica no metadata', () => {
    const ev = upd({ state: 'Read', event: { MessageIDs: ['A', 'B', 'C'], Chat: '55119@s.whatsapp.net' } });
    assert.equal(ev.messageId, 'A');
    assert.deepEqual(ev.metadata.messageIds, ['A', 'B', 'C']);
    assert.equal(ev.chatId, '55119');
  });

  test('sem MessageIDs cai para id/ID do evento', () => {
    assert.equal(upd({ state: 'Read', event: { id: 'X' } }).messageId, 'X');
    assert.equal(upd({ state: 'Read', event: { ID: 'Y' } }).messageId, 'Y');
    assert.equal(upd({ state: 'Read', event: {} }).messageId, null);
  });

  test('reação sem state reconhecido', () => {
    assert.equal(upd({ event: { reaction: '❤️' } }).type, EventTypes.MESSAGE_REACTION);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('uazapiGO — conexão', () => {
  const conn = (body) => parseUazapiWebhook(go('connection', body));

  test('conectado aceita connected, open e online', () => {
    for (const s of ['connected', 'open', 'online', 'CONNECTED']) {
      assert.equal(conn({ state: s }).type, EventTypes.ACCOUNT_CONNECTED, s);
    }
  });

  test('desconectado aceita disconnected, logged_out e closed', () => {
    for (const s of ['disconnected', 'logged_out', 'closed']) {
      assert.equal(conn({ state: s }).type, EventTypes.ACCOUNT_DISCONNECTED, s);
    }
  });

  test('estado intermediário vira mudança de status', () => {
    const ev = conn({ state: 'connecting' });
    assert.equal(ev.type, EventTypes.ACCOUNT_STATUS_CHANGED);
    assert.equal(ev.metadata.connectionStatus, 'connecting');
    assert.equal(ev.metadata.connected, undefined);
  });

  test('expõe telefone e nome da instância — usado para exibir o canal', () => {
    const ev = conn({ state: 'connected' });
    assert.equal(ev.metadata.phoneNumber, '5511999999999');
    assert.equal(ev.metadata.profileName, 'acme-suporte');
    assert.equal(ev.metadata.connected, true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('uazapiGO — EventType desconhecido', () => {
  test('não perde o evento: UNKNOWN com o nome original e o token', () => {
    const ev = parseUazapiWebhook(go('presence', { event: { from: 'x' } }));
    assert.equal(ev.type, EventTypes.UNKNOWN);
    assert.equal(ev.metadata.originalEvent, 'presence');
    assert.equal(ev.metadata.schema, 'uazapiGO');
    assert.equal(ev.accountId, TOKEN);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('timestamps', () => {
  const tsDe = (messageTimestamp) =>
    parseUazapiWebhook(classic('messages', { messageTimestamp })).timestamp;

  test('segundos são multiplicados; milissegundos passam direto', () => {
    // O limiar é 1e12: abaixo disso só pode ser segundos (1e12 ms = ano 2001).
    assert.equal(tsDe(1754000000), new Date(1754000000 * 1000).toISOString());
    assert.equal(tsDe(1754000000000), new Date(1754000000000).toISOString());
  });

  test('numérico em string funciona igual', () => {
    assert.equal(tsDe('1754000000'), new Date(1754000000 * 1000).toISOString());
  });

  test('data ISO em string é aceita', () => {
    assert.equal(tsDe('2026-08-03T12:00:00.000Z'), '2026-08-03T12:00:00.000Z');
  });

  test('valor inválido, vazio ou ausente cai para agora — nunca Invalid Date', () => {
    for (const v of [undefined, null, '', 'nao-e-data', NaN]) {
      assert.ok(!Number.isNaN(Date.parse(tsDe(v))), `valor: ${String(v)}`);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('validateUazapiSignature', () => {
  test('sempre true — o Uazapi não assina webhook', () => {
    // Comportamento documentado, não esquecimento: nem o clássico nem o
    // uazapiGO enviam HMAC por padrão. A proteção recomendada é segredo na
    // própria URL do webhook, verificado na rota do app.
    assert.equal(validateUazapiSignature({}, 'x', 'y'), true);
    assert.equal(validateUazapiSignature(null, null, null), true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('generateWebhookJobId', () => {
  test('prioriza messageId', () => {
    const ev = parseUazapiWebhook(classic('messages', { messageid: 'M-9' }));
    assert.equal(generateWebhookJobId(ev), 'uazapi:message.received:instancia-acme:M-9');
  });

  test('cai para chatId e depois timestamp', () => {
    const semMsg = parseUazapiWebhook(classic('messages', { chatid: 'C-1' }));
    assert.equal(generateWebhookJobId(semMsg), 'uazapi:message.received:instancia-acme:C-1');

    const conexao = parseUazapiWebhook(classic('connection', { connected: true }));
    assert.equal(generateWebhookJobId(conexao), `uazapi:account.connected:instancia-acme:${conexao.timestamp}`);
  });

  test('mesmo payload gera o mesmo id — é o que garante o dedup', () => {
    const p = classic('messages', { messageid: 'M-fixo' });
    assert.equal(generateWebhookJobId(parseUazapiWebhook(p)), generateWebhookJobId(parseUazapiWebhook(p)));
  });
});
