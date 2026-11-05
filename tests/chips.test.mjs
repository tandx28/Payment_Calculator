import test from 'node:test';
import assert from 'node:assert/strict';
import { chipSettings, chipEntry, chipTally, settleChips } from '../src/process/chips.mjs';
import { createRoomService, secret } from '../server/rooms.mjs';
import { createMemoryStore } from '../server/memory-store.mjs';

const poker = chipSettings({ mode: 'poker', chipsPerBuyIn: 300, buyInAmount: 20 });
const mahjong = { ...poker, mode: 'mahjong' };

test('300 chips for $20, including multiple equal poker buy-ins', () => {
  assert.equal(chipEntry(poker, { finalChips: 450, buyIns: 1 }).cents, 1000);
  assert.equal(chipEntry(poker, { finalChips: 450, buyIns: 2 }).cents, -1000);
  const settled = settleChips(poker, [{ finalChips: 450, buyIns: 2 }, { finalChips: 450, buyIns: 1 }]);
  assert.deepEqual(settled.cents, [-1000, 1000]);
  assert.equal(settled.issued, 900);
});

test('mahjong starts equally and must account for every chip', () => {
  assert.deepEqual(settleChips(mahjong, [600, 300, 300, 0].map((finalChips) => ({ finalChips }))).cents, [2000, 0, 0, -2000]);
  assert.throws(() => chipEntry(mahjong, { finalChips: 300, buyIns: 2 }), /only available for poker/);
  assert.throws(() => settleChips(mahjong, [{ finalChips: 300 }, { finalChips: 299 }]), /1 missing/);
  assert.throws(() => settleChips(poker, [{ finalChips: 450 }, { finalChips: 451 }]), /301 extra/);
});

test('fractional cents are allocated deterministically and always sum to zero', () => {
  const tiny = chipSettings({ mode: 'poker', chipsPerBuyIn: 3, buyInAmount: .01 });
  const data = [{ finalChips: 4 }, { finalChips: 4 }, { finalChips: 1 }];
  assert.deepEqual(settleChips(tiny, data).cents, [1, 0, -1]);
  assert.equal(settleChips(tiny, data).fractionalCents, true);
  // A deterministic range of balanced chip counts, covering positive and negative fractions.
  for (let a = 0; a <= 900; a += 7) {
    const data = [{ finalChips: a }, { finalChips: 900 - a }, { finalChips: 0 }];
    const result = settleChips(poker, data);
    assert.equal(result.cents.reduce((sum, value) => sum + value, 0), 0);
    result.cents.forEach((cents, index) => assert.ok(Math.abs(cents - (data[index].finalChips - 300) * 2000 / 300) < 1.000001));
  }
});

test('invalid, negative, fractional and absent chip values are rejected; zero is valid', () => {
  for (const value of ['', null, undefined, -1, 1.5, Infinity, true]) assert.throws(() => chipEntry(poker, { finalChips: value }));
  for (const buyIns of [0, -1, '', 1.5, 1001]) assert.throws(() => chipEntry(poker, { finalChips: 0, buyIns }));
  assert.equal(chipEntry(poker, { finalChips: 0 }).cents, -2000);
  assert.throws(() => chipSettings({ mode: 'poker', chipsPerBuyIn: 0, buyInAmount: 20 }));
  assert.throws(() => chipSettings({ mode: 'poker', chipsPerBuyIn: 300, buyInAmount: 0 }));
  assert.throws(() => chipSettings({ mode: 'poker', chipsPerBuyIn: 300, buyInAmount: 20.001 }));
  assert.deepEqual(chipTally(poker, [{ finalChips: null, buyIns: 2 }, { finalChips: 300 }]), { issued: 900, counted: 300, missing: 1, difference: -600 });
});

async function room(mode, overrides = {}) {
  const service = createRoomService(createMemoryStore());
  const host = await service.create({ name: 'Host', mode, chipsPerBuyIn: 300, buyInAmount: 20, ...overrides });
  const token = secret();
  await service.access(host.id, host.inviteToken, { action: 'join', name: 'Guest', playerToken: token });
  const act = async (who, action, extra = {}) => {
    const state = await service.access(host.id, who);
    return service.access(host.id, who, { action, version: state.version, ...extra });
  };
  return { service, host, token, act };
}

test('shared poker ignores supplied cash, counts rebuys, locks settlement on chip mismatch', async () => {
  const { service, host, token, act } = await room('poker');
  await assert.rejects(act(token, 'submit', { finalChips: 450, buyIns: 2 }), /host to start/);
  await act(host.token, 'start');
  await act(token, 'submit', { finalChips: 450, buyIns: 2, value: 999, memberId: host.me });
  await assert.rejects(act(host.token, 'submit', { finalChips: 450, buyIns: 1 }), /PayNow mobile/);
  let state = await act(host.token, 'submit', { finalChips: 449, buyIns: 1, mobile: '91234567' });
  assert.equal(state.phase, 'collecting');
  assert.ok(state.members.every((p) => p.ready));
  await act(host.token, 'unready');
  state = await act(host.token, 'submit', { finalChips: 450, buyIns: 1, mobile: '91234567' });
  assert.equal(state.phase, 'settled');
  assert.deepEqual(state.members.map((p) => p.cents), [1000, -1000]);
  await assert.rejects(act(token, 'submit', { finalChips: 0, buyIns: 1 }), /locked/);
  state = await act(host.token, 'new-round');
  assert.equal(state.settings.chipsPerBuyIn, 300);
  assert.ok(state.members.every((p) => p.finalChips === null && p.buyIns === 1 && !p.ready));
  assert.equal((await service.access(host.id, host.inviteToken)).members, undefined);
});

test('shared mahjong disallows extra stacks and legacy cash writes; all break-even works', async () => {
  const { host, token, act } = await room('mahjong');
  await act(host.token, 'start');
  await assert.rejects(act(token, 'submit', { finalChips: 600, buyIns: 2 }), /only available for poker/);
  await assert.rejects(act(token, 'update', { value: 0 }), /submit final chips/);
  await assert.rejects(act(token, 'ready'), /submit final chips/);
  await act(host.token, 'submit', { finalChips: 300 });
  assert.equal((await act(token, 'submit', { finalChips: 300 })).phase, 'settled');
});

test('one missing chip cannot unlock settlement even when both cash previews round to zero', async () => {
  const { host, token, act } = await room('poker', { buyInAmount: .01, chipsPerBuyIn: 300 });
  await act(host.token, 'start');
  await act(host.token, 'submit', { finalChips: 300 });
  const state = await act(token, 'submit', { finalChips: 299 });
  assert.equal(state.phase, 'collecting');
  assert.equal(state.members.reduce((sum, p) => sum + p.cents, 0), 0);
});
