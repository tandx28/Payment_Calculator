import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomService, secret, ROOM_LIFETIME } from '../server/rooms.mjs';
import { createMemoryStore } from '../server/memory-store.mjs';
import { makeHandler } from '../server/handler.mjs';
import { createRedisStore } from '../server/redis.mjs';

async function table() {
  let now = 1800000000000;
  const store = createMemoryStore(() => now);
  const service = createRoomService(store, () => now);
  const host = await service.create({ name: 'Alex', title: 'Hall kakis', mobile: '91234567' });
  const guestToken = secret();
  const guest = await service.access(host.id, host.inviteToken, { action: 'join', name: 'Ben', playerToken: guestToken });
  return { service, host, guest, guestToken, store, advance: (ms) => { now += ms; } };
}
async function act(service, room, token, action, extra = {}) {
  const latest = await service.access(room.id, token);
  return service.access(room.id, token, { action, version: latest.version, ...extra });
}

test('invite is join-only, never host access or participant data', async () => {
  const { service, host, guestToken } = await table();
  const invitation = await service.access(host.id, host.inviteToken);
  assert.equal(invitation.needsJoin, true);
  assert.equal(invitation.members, undefined);
  assert.equal(invitation.token, undefined);
  assert.equal(invitation.inviteToken, undefined);
  await assert.rejects(act(service, host, host.inviteToken, 'start'), /Join the table/);
  await assert.rejects(act(service, host, guestToken, 'start'), /Only the host/);
  await assert.rejects(service.access(host.id, secret()), /no longer valid/);
  await assert.rejects(service.access('guessable-id', host.token), /not found/);
});

test('shared invite cannot be promoted into a participant credential', async () => {
  const { service, host } = await table();
  await assert.rejects(service.access(host.id, host.inviteToken, { action: 'join', name: 'Mallory', playerToken: host.inviteToken }), /separate participant/);
});

test('host locks the roster; late joins blocked, join retries remain idempotent', async () => {
  const { service, host, guestToken } = await table();
  await act(service, host, host.token, 'start');
  await assert.rejects(service.access(host.id, host.inviteToken, { action: 'join', name: 'Cara', playerToken: secret() }), /locked this round/);
  const retry = await service.access(host.id, host.inviteToken, { action: 'join', name: 'Ben', playerToken: guestToken });
  assert.equal(retry.memberCount, 2);
  assert.equal(retry.isHost, false);
});

test('only an actor’s own result can change, and other mobile numbers remain private before settlement', async () => {
  const { service, host, guestToken } = await table();
  const next = await act(service, host, guestToken, 'update', { memberId: host.me, value: -20, mobile: '81234567' });
  assert.equal(next.members.find((person) => person.id === host.me).cents, null);
  assert.equal(next.members.find((person) => person.id === next.me).cents, -2000);
  assert.equal(next.members.find((person) => person.id === host.me).mobile, '');
  const hostView = await service.access(host.id, host.token);
  assert.equal(hostView.members.find((person) => !person.host).mobile, '');
  assert.equal(hostView.members.find((person) => person.host).mobile, '+6591234567');
});

test('all ready and exact zero are both required, then the result is immutable', async () => {
  const { service, host, guestToken } = await table();
  await act(service, host, host.token, 'update', { value: 20.15, mobile: '91234567' });
  await act(service, host, guestToken, 'update', { value: -20.14 });
  await assert.rejects(act(service, host, guestToken, 'ready'), /host to start/);
  await act(service, host, host.token, 'start');
  await act(service, host, host.token, 'ready');
  let state = await act(service, host, guestToken, 'ready');
  assert.equal(state.phase, 'collecting');
  assert.ok(state.members.every((person) => person.ready));
  state = await act(service, host, guestToken, 'update', { value: -20.15 });
  assert.equal(state.members.find((person) => person.id === state.me).ready, false);
  state = await act(service, host, guestToken, 'ready');
  assert.equal(state.phase, 'settled');
  assert.equal(state.members.find((person) => person.host).mobile, '+6591234567');
  await assert.rejects(act(service, host, guestToken, 'update', { value: -999 }), /locked/);
  await assert.rejects(act(service, host, host.token, 'unready'), /locked/);
  await assert.rejects(act(service, host, guestToken, 'new-round'), /Only the host/);
  state = await act(service, host, host.token, 'new-round');
  assert.equal(state.round, 2);
  assert.equal(state.phase, 'lobby');
  assert.ok(state.members.every((person) => !person.ready && person.cents === null));
});

test('winner needs a PayNow mobile for QR; zero and negative results do not', async () => {
  const { service, host, guestToken } = await table();
  await act(service, host, host.token, 'start');
  await act(service, host, host.token, 'update', { value: 20, mobile: '' });
  await assert.rejects(act(service, host, host.token, 'ready'), /PayNow mobile/);
  await act(service, host, guestToken, 'update', { value: -20 });
  assert.equal((await act(service, host, guestToken, 'ready')).phase, 'collecting');
  await assert.rejects(act(service, host, host.token, 'update', { value: 0.001 }), /decimal/);
});

test('simultaneous writes cannot overwrite a newer result', async () => {
  const { service, host, guestToken } = await table();
  const version = (await service.access(host.id, host.token)).version;
  const results = await Promise.allSettled([
    service.access(host.id, host.token, { action: 'update', version, value: 20 }),
    service.access(host.id, guestToken, { action: 'update', version, value: -20 }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.status, 409);
  const final = await service.access(host.id, host.token);
  assert.equal(final.members.filter((person) => person.cents !== null).length, 1);
});

test('concurrent joins retain both participants', async () => {
  const { service, host } = await table();
  await Promise.all(['Cara', 'Dan'].map((name) => service.access(host.id, host.inviteToken, { action: 'join', name, playerToken: secret() })));
  assert.equal((await service.access(host.id, host.token)).memberCount, 4);
});

test('host can remove players only in lobby; removed credentials lose access', async () => {
  const { service, host, guest, guestToken } = await table();
  await act(service, host, host.token, 'remove', { memberId: guest.me });
  await assert.rejects(service.access(host.id, guestToken), /no longer valid/);
  await assert.rejects(act(service, host, host.token, 'start'), /At least two/);
  await assert.rejects(act(service, host, host.token, 'remove', { memberId: host.me }), /only be removed/);
});

test('activity does not extend the fixed 24-hour expiry', async () => {
  const { service, host, advance } = await table();
  advance(ROOM_LIFETIME - 1);
  const next = await act(service, host, host.token, 'update', { value: 0 });
  assert.equal(next.expiresAt, host.expiresAt);
  advance(2);
  await assert.rejects(service.access(host.id, host.token), /expired/);
});

async function call(handler, { method = 'GET', url = '/api/sessions?action=health', body, headers = {} } = {}) {
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
  await handler({ method, url, body, headers: { host: 'localhost', ...headers } }, response);
  return response;
}

test('API handles absent storage, caching, malformed bodies, and cross-origin writes', async () => {
  const unavailable = makeHandler(createMemoryStore(), false);
  assert.equal((await call(unavailable)).body.available, false);
  assert.equal((await call(unavailable, { method: 'POST', body: { action: 'create', name: 'Alex' } })).statusCode, 503);
  const handler = makeHandler(createMemoryStore(), true);
  const bad = await call(handler, { method: 'POST', body: '{bad' });
  assert.equal(bad.statusCode, 400);
  assert.match(bad.headers['Cache-Control'], /no-store/);
  const foreign = await call(handler, { method: 'POST', body: { action: 'create', name: 'Alex' }, headers: { origin: 'https://evil.example' } });
  assert.equal(foreign.statusCode, 403);
  const created = await call(handler, { method: 'POST', body: { action: 'create', name: 'Alex' } });
  assert.equal(created.statusCode, 201);
  assert.ok(created.body.token && created.body.inviteToken);
  const missingAuth = await call(handler, { url: `/api/sessions?id=${created.body.id}` });
  assert.equal(missingAuth.statusCode, 401);
});

test('Redis commands use absolute expiry and atomic compare-and-set over authenticated POST', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options, args: JSON.parse(options.body) }); return { ok: true, json: async () => ({ result: calls.length === 1 ? 'OK' : 1 }) }; };
  try {
    const store = createRedisStore({ url: 'https://test.invalid', token: 'server-only-token' });
    await store.create('room', 'before', 123456789);
    assert.equal(await store.compareAndSet('room', 'before', 'after', 123456789), true);
    assert.deepEqual(calls[0].args, ['SET', 'settle:room:room', 'before', 'NX', 'PXAT', 123456789]);
    assert.equal(calls[1].args[0], 'EVAL');
    assert.match(calls[1].args[1], /redis.call\('GET'/);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer server-only-token');
  } finally { globalThis.fetch = original; }
});
