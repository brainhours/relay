/**
 * Smoke test — Cloud API parser, signature, helpers, error handling.
 *
 * Runs offline (no network). Usage:
 *   node test-smoke.js
 *
 * Validates:
 *   - parseCloudApiWebhook returns NormalizedEvent[] with correct shape
 *   - all event channels covered (messages of every type, statuses, errors,
 *     message_template_status_update, account_update, unknown field)
 *   - validateCloudApiSignature accepts valid + rejects invalid
 *   - effectiveDailyLimit, stableVariant, isInWindow behave as documented
 *   - MetaApiError.fromAxiosError preserves Meta fields
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  parseCloudApiWebhook,
  validateCloudApiSignature,
  generateCloudApiWebhookJobId,
  effectiveDailyLimit,
  stableVariant,
  isInWindow,
  MetaApiError,
  META_ERROR_CODES,
  isCloudApiRetryable,
  EventTypes,
  ProviderTypes,
  parseWebhook,
  validateWebhookSignature,
  createProvider
} = require('@brainhours/relay-core');

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
console.log('\n[ webhook parser — inbound messages ]');

test('text message → MESSAGE_RECEIVED with senderName', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA1',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'PN1' },
              contacts: [{ wa_id: '5511999', profile: { name: 'Joana' } }],
              messages: [
                {
                  from: '5511999',
                  id: 'wamid.M1',
                  timestamp: '1714060800',
                  type: 'text',
                  text: { body: 'oi' }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs.length, 1);
  const e = evs[0];
  assert.equal(e.type, EventTypes.MESSAGE_RECEIVED);
  assert.equal(e.provider, 'cloud-api');
  assert.equal(e.providerType, ProviderTypes.WHATSAPP);
  assert.equal(e.accountId, 'PN1');
  assert.equal(e.chatId, '5511999');
  assert.equal(e.messageId, 'wamid.M1');
  assert.equal(e.senderName, 'Joana');
  assert.equal(e.content, 'oi');
  assert.equal(e.metadata.wabaId, 'WABA1');
  assert.equal(e.metadata.messageType, 'text');
});

test('image with caption + media id → attachment captured', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [
                {
                  from: 'X',
                  id: 'wamid.I',
                  timestamp: '1714060800',
                  type: 'image',
                  image: { id: 'media-1', mime_type: 'image/jpeg', sha256: 'abc', caption: 'Foto' }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  const e = evs[0];
  assert.equal(e.content, 'Foto');
  assert.equal(e.attachments.length, 1);
  assert.equal(e.attachments[0].id, 'media-1');
  assert.equal(e.attachments[0].mimeType, 'image/jpeg');
  assert.equal(e.attachments[0].type, 'image');
});

test('interactive button_reply → content = title', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [
                {
                  from: 'X',
                  id: 'wamid.B',
                  timestamp: '1714060800',
                  type: 'interactive',
                  interactive: { type: 'button_reply', button_reply: { id: 'YES', title: 'Sim, renovar' } }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  const e = evs[0];
  assert.equal(e.type, EventTypes.MESSAGE_RECEIVED);
  assert.equal(e.content, 'Sim, renovar');
  assert.deepEqual(e.metadata.interactive, {
    type: 'button_reply',
    button_reply: { id: 'YES', title: 'Sim, renovar' }
  });
});

test('interactive list_reply → content = title', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [
                {
                  from: 'X',
                  id: 'wamid.L',
                  timestamp: '1714060800',
                  type: 'interactive',
                  interactive: { type: 'list_reply', list_reply: { id: 'A', title: 'Opção A' } }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].content, 'Opção A');
});

test('button (template button) → content = button.text', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [
                {
                  from: 'X',
                  id: 'wamid.btn',
                  timestamp: '1714060800',
                  type: 'button',
                  button: { text: 'Click me', payload: 'PAYLOAD_1' }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].content, 'Click me');
  assert.equal(evs[0].metadata.buttonPayload, 'PAYLOAD_1');
});

test('location → content = name fallback to lat,lng', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [
                {
                  from: 'X',
                  id: 'wamid.loc1',
                  timestamp: '1714060800',
                  type: 'location',
                  location: { latitude: -23.5, longitude: -46.6, name: 'MASP' }
                },
                {
                  from: 'X',
                  id: 'wamid.loc2',
                  timestamp: '1714060801',
                  type: 'location',
                  location: { latitude: -23.5, longitude: -46.6 }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].content, 'MASP');
  assert.equal(evs[1].content, '-23.5,-46.6');
});

test('reply context preserved in metadata', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [
                {
                  from: 'X',
                  id: 'wamid.R',
                  timestamp: '1714060800',
                  type: 'text',
                  text: { body: 'reply' },
                  context: { id: 'wamid.ORIG', from: 'P' }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].metadata.contextMessageId, 'wamid.ORIG');
  assert.equal(evs[0].metadata.contextFrom, 'P');
});

// ---------------------------------------------------------------------------
console.log('\n[ webhook parser — statuses ]');

test('status sent → MESSAGE_SENT', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              statuses: [{ id: 'wamid.X', status: 'sent', timestamp: '1714060800', recipient_id: 'X' }]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].type, EventTypes.MESSAGE_SENT);
});

test('status delivered → MESSAGE_DELIVERED', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              statuses: [{ id: 'wamid.X', status: 'delivered', timestamp: '1714060800', recipient_id: 'X' }]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].type, EventTypes.MESSAGE_DELIVERED);
});

test('status read → MESSAGE_READ', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              statuses: [{ id: 'wamid.X', status: 'read', timestamp: '1714060800', recipient_id: 'X' }]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].type, EventTypes.MESSAGE_READ);
});

test('status failed → MESSAGE_FAILED with errors[]', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              statuses: [
                {
                  id: 'wamid.X',
                  status: 'failed',
                  timestamp: '1714060800',
                  recipient_id: 'X',
                  errors: [{ code: 131026, title: 'recipient is not a WhatsApp user' }]
                }
              ]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].type, EventTypes.MESSAGE_FAILED);
  assert.equal(evs[0].metadata.errors[0].code, 131026);
});

// ---------------------------------------------------------------------------
console.log('\n[ webhook parser — non-message channels ]');

test('message_template_status_update → TEMPLATE_STATUS_CHANGED', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'message_template_status_update',
            value: {
              message_template_id: 'tpl-1',
              message_template_name: 'lembrete',
              message_template_language: 'pt_BR',
              event: 'REJECTED',
              reason: 'INVALID_FORMAT'
            }
          }
        ]
      }
    ]
  });
  const e = evs[0];
  assert.equal(e.type, EventTypes.TEMPLATE_STATUS_CHANGED);
  assert.equal(e.accountId, 'WABA');
  assert.equal(e.metadata.templateName, 'lembrete');
  assert.equal(e.metadata.newStatus, 'REJECTED');
  assert.equal(e.metadata.reason, 'INVALID_FORMAT');
  assert.ok(e.isTemplateEvent());
});

test('account_update → ACCOUNT_STATUS_CHANGED', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'account_update',
            value: { event: 'PHONE_NUMBER_QUALITY_UPDATE', current_limit: 'TIER_10K' }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].type, EventTypes.ACCOUNT_STATUS_CHANGED);
});

test('unknown field → UNKNOWN with originalEvent metadata', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [{ id: 'W', changes: [{ field: 'something_new', value: { foo: 'bar' } }] }]
  });
  assert.equal(evs[0].type, EventTypes.UNKNOWN);
  assert.equal(evs[0].metadata.originalEvent, 'something_new');
});

test('change-level errors → MESSAGE_FAILED', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              errors: [{ code: 100, title: 'invalid param', message: '...' }]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs[0].type, EventTypes.MESSAGE_FAILED);
  assert.equal(evs[0].metadata.error.code, 100);
});

test('batched: multiple messages + status in one POST → multiple events', () => {
  const evs = parseCloudApiWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [
                { from: 'A', id: 'wamid.A', timestamp: '1714060800', type: 'text', text: { body: '1' } },
                { from: 'B', id: 'wamid.B', timestamp: '1714060801', type: 'text', text: { body: '2' } }
              ],
              statuses: [
                { id: 'wamid.X', status: 'read', timestamp: '1714060802', recipient_id: 'C' }
              ]
            }
          }
        ]
      }
    ]
  });
  assert.equal(evs.length, 3);
  assert.equal(evs[0].messageId, 'wamid.A');
  assert.equal(evs[1].messageId, 'wamid.B');
  assert.equal(evs[2].type, EventTypes.MESSAGE_READ);
});

test('non-WhatsApp object → empty array', () => {
  const evs = parseCloudApiWebhook({ object: 'page', entry: [] });
  assert.equal(evs.length, 0);
});

// ---------------------------------------------------------------------------
console.log('\n[ signature validation ]');

test('valid signature → true', () => {
  const secret = 'app-secret';
  const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(validateCloudApiSignature(body, sig, secret), true);
});

test('invalid signature → false', () => {
  const secret = 'app-secret';
  const body = Buffer.from('{"x":1}');
  const wrongSig = 'sha256=' + 'a'.repeat(64);
  assert.equal(validateCloudApiSignature(body, wrongSig, secret), false);
});

test('missing header → false', () => {
  assert.equal(validateCloudApiSignature(Buffer.from('x'), undefined, 'secret'), false);
  assert.equal(validateCloudApiSignature(Buffer.from('x'), 'no-prefix', 'secret'), false);
});

test('no app secret → true (dev mode)', () => {
  assert.equal(validateCloudApiSignature(Buffer.from('x'), 'sha256=abc', null), true);
  assert.equal(validateCloudApiSignature(Buffer.from('x'), 'sha256=abc', ''), true);
});

test('signature accepts string body too', () => {
  const secret = 's';
  const body = '{"y":2}';
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(Buffer.from(body, 'utf8')).digest('hex');
  assert.equal(validateCloudApiSignature(body, sig, secret), true);
});

// ---------------------------------------------------------------------------
console.log('\n[ helpers ]');

test('effectiveDailyLimit', () => {
  assert.equal(effectiveDailyLimit(250), 200);
  assert.equal(effectiveDailyLimit(1000), 800);
  assert.equal(effectiveDailyLimit(10000), 8000);
  assert.equal(effectiveDailyLimit(100000), 80000);
  assert.equal(effectiveDailyLimit('unlimited'), Infinity);
  assert.equal(effectiveDailyLimit(undefined), 0);
  assert.equal(effectiveDailyLimit(null), 0);
  assert.equal(effectiveDailyLimit(0), 0);
  assert.equal(effectiveDailyLimit(-5), 0);
  assert.equal(effectiveDailyLimit(1000, 0.5), 500);
  assert.equal(effectiveDailyLimit('TIER_10K'), 8000); // strips non-digits
});

test('stableVariant deterministic', () => {
  const v1 = stableVariant('contact-1', { salt: 'campaign-x' });
  const v2 = stableVariant('contact-1', { salt: 'campaign-x' });
  assert.equal(v1, v2);
  assert.ok(['A', 'B'].includes(v1));
});

test('stableVariant distributes across contacts (rough)', () => {
  const counts = { A: 0, B: 0 };
  for (let i = 0; i < 200; i++) counts[stableVariant(`c-${i}`)]++;
  // Both buckets should have some contacts (not 0 / 200)
  assert.ok(counts.A > 50 && counts.B > 50, `unbalanced: ${JSON.stringify(counts)}`);
});

test('stableVariant supports custom variants', () => {
  const v = stableVariant('x', { variants: ['A', 'B', 'C', 'D'], salt: 's' });
  assert.ok(['A', 'B', 'C', 'D'].includes(v));
});

test('isInWindow', () => {
  const now = Date.now();
  assert.equal(isInWindow(now - 1 * 60 * 60 * 1000, undefined, now), true);
  assert.equal(isInWindow(now - 23 * 60 * 60 * 1000, undefined, now), true);
  assert.equal(isInWindow(now - 25 * 60 * 60 * 1000, undefined, now), false);
  assert.equal(isInWindow(null), false);
  assert.equal(isInWindow(undefined), false);
  assert.equal(isInWindow(new Date(now - 60 * 1000), undefined, now), true);
});

// ---------------------------------------------------------------------------
console.log('\n[ errors ]');

test('MetaApiError preserves Meta fields from axios error', () => {
  const axiosErr = {
    response: {
      status: 400,
      data: {
        error: {
          message: 'Template name does not exist',
          code: 132001,
          error_subcode: 2494072,
          error_data: { details: 'check your template list' },
          fbtrace_id: 'TRACE-123'
        }
      },
      headers: { 'x-fb-trace-id': 'TRACE-123' }
    }
  };
  const err = MetaApiError.fromAxiosError(axiosErr);
  assert.equal(err.statusCode, 400);
  assert.equal(err.metaCode, META_ERROR_CODES.TEMPLATE_NOT_APPROVED);
  assert.equal(err.metaSubcode, 2494072);
  assert.equal(err.metaTitle, 'Template name does not exist');
  assert.equal(err.metaTraceId, 'TRACE-123');
  assert.deepEqual(err.metaDetails, { details: 'check your template list' });
});

test('isRetryable: rate limit + 5xx yes, others no', () => {
  const rateLimit = new MetaApiError({ statusCode: 429, metaCode: META_ERROR_CODES.RATE_LIMIT });
  const server = new MetaApiError({ statusCode: 503, metaCode: 1 });
  const auth = new MetaApiError({ statusCode: 401, metaCode: META_ERROR_CODES.AUTH_INVALID });
  const tplBad = new MetaApiError({ statusCode: 400, metaCode: META_ERROR_CODES.TEMPLATE_NOT_APPROVED });

  assert.equal(rateLimit.isRetryable(), true);
  assert.equal(server.isRetryable(), true);
  assert.equal(auth.isRetryable(), false);
  assert.equal(tplBad.isRetryable(), false);

  assert.equal(isCloudApiRetryable(rateLimit), true);
  assert.equal(isCloudApiRetryable(new Error('plain')), false);
});

// ---------------------------------------------------------------------------
console.log('\n[ factory wiring ]');

test("createProvider('cloud-api', cfg) returns MetaCloudApiProvider", () => {
  const p = createProvider('cloud-api', { apiVersion: 'v22.0' });
  assert.equal(p.name, 'cloud-api');
  assert.ok(p.messaging);
  assert.ok(p.templates);
  assert.ok(p.media);
  assert.ok(p.account);
});

test("parseWebhook('cloud-api', body) delegates", () => {
  const evs = parseWebhook('cloud-api', {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'W',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'P' },
              messages: [{ from: 'X', id: 'wamid.A', timestamp: '1714060800', type: 'text', text: { body: 'hi' } }]
            }
          }
        ]
      }
    ]
  });
  assert.ok(Array.isArray(evs));
  assert.equal(evs[0].type, EventTypes.MESSAGE_RECEIVED);
});

test("validateWebhookSignature('cloud-api', ...) delegates", () => {
  const secret = 's';
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(validateWebhookSignature('cloud-api', body, sig, secret), true);
});

test('generateCloudApiWebhookJobId is deterministic + unique-ish', () => {
  const id1 = generateCloudApiWebhookJobId({
    type: EventTypes.MESSAGE_RECEIVED,
    accountId: 'P',
    messageId: 'wamid.A',
    timestamp: 't'
  });
  const id2 = generateCloudApiWebhookJobId({
    type: EventTypes.MESSAGE_RECEIVED,
    accountId: 'P',
    messageId: 'wamid.A',
    timestamp: 't'
  });
  assert.equal(id1, id2);
  assert.ok(id1.startsWith('cloud-api:'));
  assert.ok(id1.includes('wamid.A'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
