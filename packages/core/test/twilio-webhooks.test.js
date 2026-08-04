/**
 * Twilio — parser de webhook e assinatura X-Twilio-Signature.
 *
 * Duas coisas distinguem o Twilio dos demais providers:
 *
 * 1. O corpo é FORM-ENCODED, não JSON. O parser recebe o objeto já decodificado,
 *    mas todo valor chega como STRING — inclusive números. Daí as conversões
 *    explícitas de NumMedia, NumSegments e ErrorCode.
 *
 * 2. O mesmo endpoint recebe mensagem recebida E callback de status, sem um
 *    campo que diga qual é. A distinção é inferida: tem `Body`/`NumMedia` e o
 *    status é vazio ou 'received' → é inbound. Errar isso faz um callback de
 *    entrega virar mensagem nova na conversa do cliente.
 *
 * O canal (SMS ou WhatsApp) vem do prefixo do endereço — `whatsapp:+55...`
 * contra `+55...` puro.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseTwilioWebhook,
  validateTwilioSignature,
  computeTwilioSignature,
  generateWebhookJobId,
  TWILIO_STATUS_MAP
} = require('../src/providers/twilio/webhooks');
const { EventTypes, ProviderTypes } = require('../src/events/types');

const SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const CLIENTE = '+5511988887777';
const EMPRESA = '+5511333334444';

const inbound = (over = {}) => ({
  AccountSid: SID,
  MessageSid: 'SM1234567890',
  From: CLIENTE,
  To: EMPRESA,
  Body: 'Olá',
  NumMedia: '0',
  NumSegments: '1',
  ...over
});

const status = (MessageStatus, over = {}) => ({
  AccountSid: SID,
  MessageSid: 'SM1234567890',
  MessageStatus,
  From: EMPRESA,
  To: CLIENTE,
  ...over
});

// ───────────────────────────────────────────────────────────────────────────
describe('inbound vs callback de status', () => {
  test('com Body e sem status → mensagem recebida', () => {
    const ev = parseTwilioWebhook(inbound());
    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
    assert.equal(ev.metadata.originalEvent, 'inbound');
  });

  test('status "received" também é inbound', () => {
    assert.equal(parseTwilioWebhook(inbound({ SmsStatus: 'received' })).type, EventTypes.MESSAGE_RECEIVED);
  });

  test('com MessageStatus de entrega → callback, não mensagem nova', () => {
    // Tratar callback como inbound criaria uma mensagem fantasma na conversa
    // a cada atualização de entrega.
    const ev = parseTwilioWebhook(status('delivered'));
    assert.equal(ev.type, EventTypes.MESSAGE_DELIVERED);
    assert.equal(ev.metadata.originalEvent, 'status');
  });

  test('NumMedia sem Body ainda conta como inbound (mídia sem legenda)', () => {
    const ev = parseTwilioWebhook({ AccountSid: SID, From: CLIENTE, To: EMPRESA, NumMedia: '1', MediaUrl0: 'https://api.twilio.com/m/ME1' });
    assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
  });

  test('payload sem Body e sem status vira UNKNOWN', () => {
    assert.equal(parseTwilioWebhook({ AccountSid: SID }).type, EventTypes.UNKNOWN);
  });

  test('payload nulo, indefinido ou vazio não quebra', () => {
    for (const p of [null, undefined, {}]) {
      assert.equal(parseTwilioWebhook(p).provider, 'twilio');
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('mapa de status', () => {
  test('estados pré-envio e sent convergem para MESSAGE_SENT', () => {
    // O app não precisa de um tipo por etapa da fila; o valor exato do Twilio
    // fica em metadata.status para quem quiser detalhar.
    for (const s of ['accepted', 'scheduled', 'queued', 'sending', 'sent']) {
      assert.equal(parseTwilioWebhook(status(s)).type, EventTypes.MESSAGE_SENT, s);
    }
  });

  test('delivered, read, undelivered e failed', () => {
    assert.equal(parseTwilioWebhook(status('delivered')).type, EventTypes.MESSAGE_DELIVERED);
    assert.equal(parseTwilioWebhook(status('read')).type, EventTypes.MESSAGE_READ);
    assert.equal(parseTwilioWebhook(status('undelivered')).type, EventTypes.MESSAGE_FAILED);
    assert.equal(parseTwilioWebhook(status('failed')).type, EventTypes.MESSAGE_FAILED);
  });

  test('é case-insensitive e preserva o valor original', () => {
    const ev = parseTwilioWebhook(status('DELIVERED'));
    assert.equal(ev.type, EventTypes.MESSAGE_DELIVERED);
    assert.equal(ev.metadata.status, 'delivered');
  });

  test('SmsStatus funciona como alternativa a MessageStatus', () => {
    assert.equal(parseTwilioWebhook({ AccountSid: SID, SmsStatus: 'delivered', To: CLIENTE }).type, EventTypes.MESSAGE_DELIVERED);
  });

  test('status desconhecido → UNKNOWN', () => {
    assert.equal(parseTwilioWebhook(status('canceled')).type, EventTypes.UNKNOWN);
  });

  test('o mapa é congelado', () => {
    assert.ok(Object.isFrozen(TWILIO_STATUS_MAP));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('canal SMS vs WhatsApp pelo prefixo do endereço', () => {
  test('prefixo whatsapp: define o canal e é removido do endereço', () => {
    const ev = parseTwilioWebhook(inbound({ From: `whatsapp:${CLIENTE}`, To: `whatsapp:${EMPRESA}` }));
    assert.equal(ev.providerType, ProviderTypes.WHATSAPP);
    assert.equal(ev.metadata.channel, 'whatsapp');
    // o número guardado é limpo — é ele que casa com o contato no banco
    assert.equal(ev.chatId, CLIENTE);
  });

  test('sem prefixo é SMS', () => {
    const ev = parseTwilioWebhook(inbound());
    assert.equal(ev.providerType, ProviderTypes.SMS);
    assert.equal(ev.metadata.channel, 'sms');
    assert.equal(ev.chatId, CLIENTE);
  });

  test('o canal sai do endereço do CLIENTE nos dois sentidos', () => {
    // No inbound o cliente é `From`; no callback de status é `To`.
    const entrada = parseTwilioWebhook(inbound({ From: `whatsapp:${CLIENTE}` }));
    const saida = parseTwilioWebhook(status('delivered', { To: `whatsapp:${CLIENTE}`, From: `whatsapp:${EMPRESA}` }));
    assert.equal(entrada.providerType, ProviderTypes.WHATSAPP);
    assert.equal(saida.providerType, ProviderTypes.WHATSAPP);
    assert.equal(entrada.chatId, CLIENTE);
    assert.equal(saida.chatId, CLIENTE);
  });

  test('chatId é sempre o cliente — é a chave da conversa', () => {
    assert.equal(parseTwilioWebhook(inbound()).chatId, CLIENTE);
    assert.equal(parseTwilioWebhook(status('delivered')).chatId, CLIENTE);
  });

  test('senderId inverte conforme a direção', () => {
    assert.equal(parseTwilioWebhook(inbound()).senderId, CLIENTE);
    assert.equal(parseTwilioWebhook(status('sent')).senderId, EMPRESA);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('contrato e metadata', () => {
  test('campos principais', () => {
    const ev = parseTwilioWebhook(inbound({ ProfileName: 'Joana', Body: 'Bom dia' }));
    assert.equal(ev.provider, 'twilio');
    assert.equal(ev.accountId, SID);
    assert.equal(ev.messageId, 'SM1234567890');
    assert.equal(ev.senderName, 'Joana');
    assert.equal(ev.content, 'Bom dia');
  });

  test('accountId cai para MessagingServiceSid', () => {
    const ev = parseTwilioWebhook(inbound({ AccountSid: undefined, MessagingServiceSid: 'MG123' }));
    assert.equal(ev.accountId, 'MG123');
  });

  test('messageId aceita MessageSid, SmsSid e SmsMessageSid', () => {
    assert.equal(parseTwilioWebhook(inbound({ MessageSid: undefined, SmsSid: 'SM-a' })).messageId, 'SM-a');
    assert.equal(parseTwilioWebhook(inbound({ MessageSid: undefined, SmsMessageSid: 'SM-b' })).messageId, 'SM-b');
  });

  test('números chegam como string e são convertidos', () => {
    // Form-encoded não tem tipo: tudo é string. Sem a conversão, o consumidor
    // faria comparação numérica contra "0" e "1".
    const ev = parseTwilioWebhook(inbound({ NumMedia: '2', NumSegments: '3' }));
    assert.equal(ev.metadata.numMedia, 2);
    assert.equal(ev.metadata.numSegments, 3);
    assert.equal(typeof ev.metadata.numMedia, 'number');
  });

  test('erro de entrega vira número e preserva a mensagem', () => {
    const ev = parseTwilioWebhook(status('failed', { ErrorCode: '30008', ErrorMessage: 'Unknown error' }));
    assert.equal(ev.metadata.errorCode, 30008);
    assert.equal(ev.metadata.errorMessage, 'Unknown error');
  });

  test('preço e unidade são preservados para conciliação', () => {
    const ev = parseTwilioWebhook(status('delivered', { Price: '-0.00750', PriceUnit: 'USD' }));
    assert.equal(ev.metadata.price, '-0.00750');
    assert.equal(ev.metadata.priceUnit, 'USD');
  });

  test('resposta de botão do WhatsApp', () => {
    const ev = parseTwilioWebhook(inbound({ ButtonText: 'Confirmar', ButtonPayload: 'CONF_1' }));
    assert.equal(ev.metadata.buttonText, 'Confirmar');
    assert.equal(ev.metadata.buttonPayload, 'CONF_1');
  });

  test('contexto de resposta e localização', () => {
    const resp = parseTwilioWebhook(inbound({ OriginalRepliedMessageSid: 'SM-orig' }));
    assert.equal(resp.metadata.originalRepliedMessageSid, 'SM-orig');
    const geo = parseTwilioWebhook(inbound({ Latitude: '-23.5', Longitude: '-46.6' }));
    assert.equal(geo.metadata.latitude, '-23.5');
  });

  test('geo do remetente informada pela operadora', () => {
    const ev = parseTwilioWebhook(inbound({ FromCity: 'SAO PAULO', FromState: 'SP', FromCountry: 'BR' }));
    assert.equal(ev.metadata.fromCity, 'SAO PAULO');
    assert.equal(ev.metadata.fromCountry, 'BR');
  });

  test('campos ausentes somem do metadata', () => {
    const ev = parseTwilioWebhook(inbound());
    assert.ok(!('errorCode' in ev.metadata));
    assert.ok(!('buttonText' in ev.metadata));
  });

  test('timestamp é carimbado no recebimento — Twilio não manda o do evento', () => {
    const ev = parseTwilioWebhook(inbound());
    assert.ok(!Number.isNaN(Date.parse(ev.timestamp)));
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('anexos (MMS e mídia de WhatsApp)', () => {
  test('coleta MediaUrl0..N conforme NumMedia', () => {
    const ev = parseTwilioWebhook(inbound({
      NumMedia: '2',
      MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME111',
      MediaContentType0: 'image/jpeg',
      MediaUrl1: 'https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME222',
      MediaContentType1: 'application/pdf'
    }));
    assert.equal(ev.attachments.length, 2);
    assert.equal(ev.attachments[0].mimeType, 'image/jpeg');
    // o Media SID é o último segmento da URL — é ele que baixa o arquivo
    assert.equal(ev.attachments[0].id, 'ME111');
    assert.equal(ev.attachments[1].id, 'ME222');
  });

  test('NumMedia zero, ausente ou inválido resulta em nenhum anexo', () => {
    assert.deepEqual(parseTwilioWebhook(inbound({ NumMedia: '0' })).attachments, []);
    assert.deepEqual(parseTwilioWebhook(inbound({ NumMedia: undefined })).attachments, []);
    assert.deepEqual(parseTwilioWebhook(inbound({ NumMedia: 'abc' })).attachments, []);
  });

  test('índice sem URL é pulado sem quebrar a lista', () => {
    const ev = parseTwilioWebhook(inbound({
      NumMedia: '3',
      MediaUrl0: 'https://api.twilio.com/x/ME1',
      MediaUrl2: 'https://api.twilio.com/x/ME3'
    }));
    assert.equal(ev.attachments.length, 2);
    assert.deepEqual(ev.attachments.map(a => a.id), ['ME1', 'ME3']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('assinatura X-Twilio-Signature', () => {
  const TOKEN = 'auth-token-de-teste';
  const URL = 'https://api.acme.com/webhooks/twilio';
  const params = { MessageSid: 'SM1', From: '+5511988887777', Body: 'oi' };

  test('assinatura calculada é aceita', () => {
    const sig = computeTwilioSignature(TOKEN, URL, params);
    assert.equal(validateTwilioSignature(URL, params, sig, TOKEN), true);
  });

  test('o cálculo ordena os parâmetros alfabeticamente', () => {
    // O algoritmo do Twilio concatena key+value em ordem alfabética de chave;
    // se a ordem do objeto influenciasse, a validação falharia conforme o
    // JSON chegasse embaralhado.
    const a = computeTwilioSignature(TOKEN, URL, { b: '2', a: '1', c: '3' });
    const b = computeTwilioSignature(TOKEN, URL, { c: '3', a: '1', b: '2' });
    assert.equal(a, b);
  });

  test('rejeita token errado, URL diferente e parâmetro alterado', () => {
    const sig = computeTwilioSignature(TOKEN, URL, params);
    assert.equal(validateTwilioSignature(URL, params, sig, 'token-errado'), false);
    assert.equal(validateTwilioSignature(URL + '?x=1', params, sig, TOKEN), false);
    assert.equal(validateTwilioSignature(URL, { ...params, Body: 'adulterado' }, sig, TOKEN), false);
  });

  test('rejeita header ausente ou vazio', () => {
    for (const h of ['', null, undefined, 42]) {
      assert.equal(validateTwilioSignature(URL, params, h, TOKEN), false, String(h));
    }
  });

  test('rejeita assinatura de tamanho diferente sem lançar', () => {
    assert.equal(validateTwilioSignature(URL, params, 'curta', TOKEN), false);
  });

  test('sem authToken retorna true — conveniência de dev, deliberada', () => {
    assert.equal(validateTwilioSignature(URL, params, 'qualquer', ''), true);
    assert.equal(validateTwilioSignature(URL, params, undefined, null), true);
  });

  test('params ausente é tratado como vazio', () => {
    const sig = computeTwilioSignature(TOKEN, URL, {});
    assert.equal(validateTwilioSignature(URL, undefined, sig, TOKEN), true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('generateWebhookJobId', () => {
  test('usa messageId', () => {
    const ev = parseTwilioWebhook(inbound({ MessageSid: 'SM-abc' }));
    assert.equal(generateWebhookJobId(ev), `twilio:message.received:${SID}:SM-abc`);
  });

  test('inbound e status da mesma mensagem geram ids diferentes', () => {
    // Se colidissem, o callback de entrega seria descartado como duplicata do
    // recebimento e a mensagem nunca sairia de "enviada".
    const a = generateWebhookJobId(parseTwilioWebhook(inbound({ MessageSid: 'SM-1' })));
    const b = generateWebhookJobId(parseTwilioWebhook(status('delivered', { MessageSid: 'SM-1' })));
    assert.notEqual(a, b);
  });
});
