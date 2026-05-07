/**
 * Smoke test — Uazapi webhook parser & server pool.
 *
 * Runs offline (no network). Usage:
 *   node test-smoke.js
 *
 * Validates:
 *   - parseUazapiWebhook normalizes each event channel correctly
 *   - the server pool implements all selection strategies as advertised
 */

const assert = require('node:assert/strict');
const {
  parseWebhook,
  EventTypes,
  ProviderTypes,
  UazapiProvider
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
    console.log(`    ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

console.log('\n[ webhook parser ]');

test('messages received (fromMe=false)', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages',
    instance: 'inst-1',
    data: {
      messageid: 'M1',
      chatid: '5511999999999@s.whatsapp.net',
      sender: '5511999999999@s.whatsapp.net',
      senderName: 'Fulano',
      fromMe: false,
      isGroup: false,
      messageType: 'conversation',
      text: 'olá',
      messageTimestamp: 1672531200000,
      wasSentByApi: false
    }
  });
  assert.equal(ev.type, EventTypes.MESSAGE_RECEIVED);
  assert.equal(ev.provider, 'uazapi');
  assert.equal(ev.providerType, ProviderTypes.WHATSAPP);
  assert.equal(ev.accountId, 'inst-1');
  assert.equal(ev.chatId, '5511999999999@s.whatsapp.net');
  assert.equal(ev.messageId, 'M1');
  assert.equal(ev.senderName, 'Fulano');
  assert.equal(ev.content, 'olá');
  assert.equal(ev.metadata.isGroup, false);
  assert.equal(ev.metadata.fromMe, false);
  assert.equal(ev.metadata.originalEvent, 'messages');
  assert.equal(ev.metadata.senderShort, '5511999999999');
});

test('messages sent (fromMe=true)', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages',
    instance: 'inst-1',
    data: { fromMe: true, messageid: 'M2', chatid: 'X@s.whatsapp.net', text: 'hi' }
  });
  assert.equal(ev.type, EventTypes.MESSAGE_SENT);
  assert.equal(ev.metadata.fromMe, true);
});

test('messages_update -> read', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages_update',
    instance: 'inst-1',
    data: { messageid: 'M1', status: 'Read' }
  });
  assert.equal(ev.type, EventTypes.MESSAGE_READ);
});

test('messages_update -> delivered', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages_update',
    instance: 'inst-1',
    data: { messageid: 'M1', status: 'Delivered' }
  });
  assert.equal(ev.type, EventTypes.MESSAGE_DELIVERED);
});

test('messages_update -> edited', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages_update',
    instance: 'inst-1',
    data: { messageid: 'M1', edited: 'edited content' }
  });
  assert.equal(ev.type, EventTypes.MESSAGE_EDITED);
});

test('messages_update -> deleted', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages_update',
    instance: 'inst-1',
    data: { messageid: 'M1', deleted: true }
  });
  assert.equal(ev.type, EventTypes.MESSAGE_DELETED);
});

test('messages_update -> reaction', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages_update',
    instance: 'inst-1',
    data: { messageid: 'M1', reaction: '👍' }
  });
  assert.equal(ev.type, EventTypes.MESSAGE_REACTION);
});

test('connection up', () => {
  const ev = parseWebhook('uazapi', {
    event: 'connection',
    instance: 'inst-1',
    data: { connected: true }
  });
  assert.equal(ev.type, EventTypes.ACCOUNT_CONNECTED);
});

test('connection down', () => {
  const ev = parseWebhook('uazapi', {
    event: 'connection',
    instance: 'inst-1',
    data: { connected: false, lastDisconnectReason: 'logout' }
  });
  assert.equal(ev.type, EventTypes.ACCOUNT_DISCONNECTED);
  assert.equal(ev.metadata.lastDisconnectReason, 'logout');
});

test('attachments extracted from imageMessage', () => {
  const ev = parseWebhook('uazapi', {
    event: 'messages',
    instance: 'inst-1',
    data: {
      messageid: 'M3',
      chatid: 'X@s.whatsapp.net',
      content: {
        imageMessage: {
          url: 'https://files.uazapi.com/img.jpg',
          mimetype: 'image/jpeg',
          fileLength: 12345,
          mediaKey: 'mk1'
        }
      }
    }
  });
  assert.ok(ev.attachments.length >= 1);
  const att = ev.attachments[0];
  assert.equal(att.url, 'https://files.uazapi.com/img.jpg');
  assert.equal(att.mimeType, 'image/jpeg');
  assert.equal(att.size, 12345);
});

test('unknown event channel falls through to UNKNOWN', () => {
  const ev = parseWebhook('uazapi', {
    event: 'presence',
    instance: 'inst-1',
    data: { sender: 'X@s.whatsapp.net' }
  });
  assert.equal(ev.type, EventTypes.UNKNOWN);
  assert.equal(ev.metadata.originalEvent, 'presence');
});

console.log('\n[ server pool ]');

(async () => {
  await asyncTest('weighted-round-robin distributes 2:4:10', async () => {
    const p = new UazapiProvider({
      servers: [
        { id: 'a', baseUrl: 'https://a.uazapi.com', adminToken: 't1', capacity: 2 },
        { id: 'b', baseUrl: 'https://b.uazapi.com', adminToken: 't2', capacity: 4 },
        { id: 'c', baseUrl: 'https://c.uazapi.com', adminToken: 't3', capacity: 10 }
      ],
      selectionStrategy: 'weighted-round-robin'
    });
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 16; i++) {
      const s = await p.pool.pickForCreate({ name: 'x' + i });
      counts[s.id]++;
    }
    assert.deepEqual(counts, { a: 2, b: 4, c: 10 });
  });

  await asyncTest('round-robin alternates', async () => {
    const p = new UazapiProvider({
      servers: [
        { id: 'a', baseUrl: 'https://a.uazapi.com', adminToken: 't1' },
        { id: 'b', baseUrl: 'https://b.uazapi.com', adminToken: 't2' }
      ],
      selectionStrategy: 'round-robin'
    });
    const seq = [];
    for (let i = 0; i < 6; i++) {
      seq.push((await p.pool.pickForCreate()).id);
    }
    assert.deepEqual(seq, ['a', 'b', 'a', 'b', 'a', 'b']);
  });

  await asyncTest('disabled server skipped in pickForCreate but available in resolve', async () => {
    const p = new UazapiProvider({
      servers: [
        { id: 'a', baseUrl: 'https://a.uazapi.com', adminToken: 't1' },
        { id: 'b', baseUrl: 'https://b.uazapi.com', adminToken: 't2' }
      ]
    });
    p.pool.disable('b');
    assert.equal((await p.pool.pickForCreate()).id, 'a');
    assert.equal(p.pool.resolve({ serverId: 'b' }).id, 'b');
  });

  await asyncTest('least-loaded picks least busy by ratio', async () => {
    const loads = { a: 1, b: 0 };
    const p = new UazapiProvider({
      servers: [
        { id: 'a', baseUrl: 'https://a.uazapi.com', adminToken: 't1', capacity: 2 },
        { id: 'b', baseUrl: 'https://b.uazapi.com', adminToken: 't2', capacity: 10 }
      ],
      selectionStrategy: 'least-loaded',
      getServerLoad: async (id) => loads[id]
    });
    assert.equal((await p.pool.pickForCreate()).id, 'b');
  });

  await asyncTest('fill-first fills small server first', async () => {
    const loads = { a: 0, b: 0 };
    const p = new UazapiProvider({
      servers: [
        { id: 'a', baseUrl: 'https://a.uazapi.com', adminToken: 't1', capacity: 2 },
        { id: 'b', baseUrl: 'https://b.uazapi.com', adminToken: 't2', capacity: 10 }
      ],
      selectionStrategy: 'fill-first',
      getServerLoad: async (id) => loads[id]
    });
    assert.equal((await p.pool.pickForCreate()).id, 'a');
    loads.a = 2;                       // 'a' full
    assert.equal((await p.pool.pickForCreate()).id, 'b');
  });

  await asyncTest('custom strategy receives ctx and currentLoads', async () => {
    const p = new UazapiProvider({
      servers: [
        { id: 'a', baseUrl: 'https://a.uazapi.com', adminToken: 't1', tags: ['cheap'] },
        { id: 'b', baseUrl: 'https://b.uazapi.com', adminToken: 't2', tags: ['premium'] }
      ],
      selectionStrategy: (eligible, ctx) => {
        return ctx.name?.startsWith('premium-')
          ? eligible.find((s) => s.tags?.includes('premium'))
          : eligible[0];
      }
    });
    assert.equal((await p.pool.pickForCreate({ name: 'premium-acme' })).id, 'b');
    assert.equal((await p.pool.pickForCreate({ name: 'free-tier' })).id, 'a');
  });

  await asyncTest('runtime reconfig: add/update/remove', async () => {
    const p = new UazapiProvider({
      servers: [{ id: 'a', baseUrl: 'https://a.uazapi.com', adminToken: 't1' }]
    });
    p.pool.add({ id: 'b', baseUrl: 'https://b.uazapi.com', adminToken: 't2' });
    assert.equal(p.pool.size(), 2);
    p.pool.update('a', { capacity: 5 });
    assert.equal(p.pool.get('a').capacity, 5);
    p.pool.remove('a');
    assert.equal(p.pool.size(), 1);
    assert.equal(p.pool.get('b').id, 'b');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
