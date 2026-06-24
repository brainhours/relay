/**
 * Smoke test — Twilio parser, signature, TwiML, helpers, error handling.
 *
 * Runs offline (no network). Usage:
 *   node test-smoke.js
 *
 * Validates:
 *   - parseTwilioWebhook normalizes inbound (SMS + WhatsApp) and status callbacks
 *   - channel detection + bare-number stripping
 *   - inbound MMS attachments
 *   - validateTwilioSignature accepts valid + rejects invalid (Twilio's docs vector)
 *   - messagingResponse / emptyMessagingResponse TwiML + XML escaping
 *   - TwilioApiError.fromAxiosError preserves fields; isRetryable behaves
 *   - generic parseWebhook / validateWebhookSignature dispatch
 */

const assert = require('node:assert/strict');
const {
  TwilioProvider,
  parseTwilioWebhook,
  validateTwilioSignature,
  computeTwilioSignature,
  generateTwilioWebhookJobId,
  messagingResponse,
  emptyMessagingResponse,
  redirectResponse,
  toChannelAddress,
  parseChannelAddress,
  TwilioApiError,
  TWILIO_ERROR_CODES,
  isTwilioRetryable,
  EventTypes,
  ProviderTypes,
  parseWebhook,
  validateWebhookSignature,
  createProvider
} = require('@guilhermegoulart1/relay-core');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.stack || err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
console.log('\n[ provider / factory ]');

test('createProvider("twilio") wires the managers', () => {
  const t = createProvider('twilio', { accountSid: 'ACx', authToken: 'tok' });
  assert.equal(t.name, 'twilio');
  assert.ok(t.isInitialized());
  assert.ok(t.messaging && t.media && t.account);
});

test('getError reports missing creds', () => {
  const t = new TwilioProvider({});
  assert.equal(t.isInitialized(), false);
  assert.match(t.getError(), /accountSid/);
});

// ---------------------------------------------------------------------------
console.log('\n[ address helpers ]');

test('toChannelAddress adds whatsapp prefix idempotently', () => {
  assert.equal(toChannelAddress('+5511999', 'whatsapp'), 'whatsapp:+5511999');
  assert.equal(toChannelAddress('whatsapp:+5511999', 'whatsapp'), 'whatsapp:+5511999');
  assert.equal(toChannelAddress('+5511999', 'sms'), '+5511999');
});

test('parseChannelAddress splits channel + bare number', () => {
  assert.deepEqual(parseChannelAddress('whatsapp:+5511999'), { channel: 'whatsapp', address: '+5511999' });
  assert.deepEqual(parseChannelAddress('+5511999'), { channel: 'sms', address: '+5511999' });
});

// ---------------------------------------------------------------------------
console.log('\n[ webhook parser — inbound ]');

test('inbound WhatsApp text → MESSAGE_RECEIVED', () => {
  const e = parseTwilioWebhook({
    MessageSid: 'SM1',
    AccountSid: 'ACx',
    From: 'whatsapp:+5511999',
    To: 'whatsapp:+14155238886',
    Body: 'oi',
    NumMedia: '0',
    ProfileName: 'Joana',
    WaId: '5511999',
    SmsStatus: 'received'
  });
  assert.equal(e.type, EventTypes.MESSAGE_RECEIVED);
  assert.equal(e.provider, 'twilio');
  assert.equal(e.providerType, ProviderTypes.WHATSAPP);
  assert.equal(e.accountId, 'ACx');
  assert.equal(e.chatId, '+5511999');
  assert.equal(e.senderId, '+5511999');
  assert.equal(e.senderName, 'Joana');
  assert.equal(e.content, 'oi');
  assert.equal(e.metadata.channel, 'whatsapp');
  assert.equal(e.metadata.to, '+14155238886');
  assert.equal(e.metadata.waId, '5511999');
});

test('inbound MMS surfaces attachments', () => {
  const e = parseTwilioWebhook({
    MessageSid: 'MM1',
    AccountSid: 'ACx',
    From: '+15551234567',
    To: '+12025550123',
    Body: 'pic',
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/ACx/Messages/MM1/Media/ME9',
    MediaContentType0: 'image/jpeg'
  });
  assert.equal(e.providerType, ProviderTypes.SMS);
  assert.equal(e.attachments.length, 1);
  assert.equal(e.attachments[0].mimeType, 'image/jpeg');
  assert.equal(e.attachments[0].id, 'ME9');
});

// ---------------------------------------------------------------------------
console.log('\n[ webhook parser — status callbacks ]');

test('delivered status → MESSAGE_DELIVERED', () => {
  const e = parseTwilioWebhook({
    MessageSid: 'SM2',
    AccountSid: 'ACx',
    From: '+12025550123',
    To: '+5511999',
    MessageStatus: 'delivered'
  });
  assert.equal(e.type, EventTypes.MESSAGE_DELIVERED);
  assert.equal(e.chatId, '+5511999');
  assert.equal(e.metadata.status, 'delivered');
});

test('failed status carries numeric errorCode', () => {
  const e = parseTwilioWebhook({
    MessageSid: 'SM3',
    AccountSid: 'ACx',
    From: '+1',
    To: '+2',
    MessageStatus: 'failed',
    ErrorCode: '30007'
  });
  assert.equal(e.type, EventTypes.MESSAGE_FAILED);
  assert.equal(e.metadata.errorCode, 30007);
});

test('queued/sent/read map as documented', () => {
  const mk = (s) => parseTwilioWebhook({ MessageSid: 'X', AccountSid: 'A', From: '+1', To: '+2', MessageStatus: s }).type;
  assert.equal(mk('queued'), EventTypes.MESSAGE_SENT);
  assert.equal(mk('sent'), EventTypes.MESSAGE_SENT);
  assert.equal(mk('read'), EventTypes.MESSAGE_READ);
});

test('generic parseWebhook("twilio", ...) dispatches', () => {
  const e = parseWebhook('twilio', { MessageSid: 'SM9', AccountSid: 'ACx', From: '+1', To: '+2', Body: 'hi', NumMedia: '0', SmsStatus: 'received' });
  assert.equal(e.type, EventTypes.MESSAGE_RECEIVED);
});

test('generateTwilioWebhookJobId is deterministic', () => {
  const e = parseTwilioWebhook({ MessageSid: 'SM1', AccountSid: 'ACx', From: '+1', To: '+2', MessageStatus: 'delivered' });
  assert.equal(generateTwilioWebhookJobId(e), 'twilio:message.delivered:ACx:SM1');
});

// ---------------------------------------------------------------------------
console.log('\n[ signature validation ]');

test('compute + validate roundtrip', () => {
  // Vector shape from Twilio's docs (request URL + sorted POST params).
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
  const params = { Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };
  const sig = computeTwilioSignature('12345', url, params);
  assert.ok(validateTwilioSignature(url, params, sig, '12345'));
  assert.ok(!validateTwilioSignature(url, params, 'wrong', '12345'));
});

test('falsy token => true (dev convenience)', () => {
  assert.ok(validateTwilioSignature('https://x', {}, 'anything', ''));
});

test('generic validateWebhookSignature("twilio", {url,params}, ...)', () => {
  const url = 'https://x/y';
  const params = { A: '1', B: '2' };
  const sig = computeTwilioSignature('tok', url, params);
  assert.ok(validateWebhookSignature('twilio', { url, params }, sig, 'tok'));
  assert.ok(!validateWebhookSignature('twilio', { url, params }, 'bad', 'tok'));
});

// ---------------------------------------------------------------------------
console.log('\n[ TwiML builders ]');

test('messagingResponse escapes XML', () => {
  const xml = messagingResponse('Thanks & welcome <user>!');
  assert.ok(xml.includes('<Message>Thanks &amp; welcome &lt;user&gt;!</Message>'));
});

test('messagingResponse supports media + multiple messages', () => {
  const xml = messagingResponse([{ body: 'see this', mediaUrl: 'https://x/a.jpg' }, 'second']);
  assert.ok(xml.includes('<Media>https://x/a.jpg</Media>'));
  assert.ok(xml.includes('<Message>second</Message>'));
});

test('emptyMessagingResponse / redirectResponse', () => {
  assert.ok(emptyMessagingResponse().includes('<Response></Response>'));
  assert.ok(redirectResponse('https://x/next').includes('<Redirect method="POST">https://x/next</Redirect>'));
});

// ---------------------------------------------------------------------------
console.log('\n[ errors ]');

test('fromAxiosError preserves Twilio fields', () => {
  const err = TwilioApiError.fromAxiosError({
    response: { status: 400, data: { code: 21211, message: "Invalid 'To'", more_info: 'https://x' } }
  });
  assert.equal(err.statusCode, 400);
  assert.equal(err.twilioCode, TWILIO_ERROR_CODES.INVALID_TO_NUMBER);
  assert.equal(err.moreInfo, 'https://x');
  assert.equal(err.isRetryable(), false);
});

test('isRetryable: 429 + WhatsApp rate limit yes; invalid number no', () => {
  const rl = TwilioApiError.fromAxiosError({ response: { status: 429, data: { code: 20429, message: 'rl' } } });
  assert.ok(rl.isRetryable());
  assert.ok(isTwilioRetryable(rl));
  const bad = TwilioApiError.fromAxiosError({ response: { status: 400, data: { code: 21211 } } });
  assert.ok(!isTwilioRetryable(bad));
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
