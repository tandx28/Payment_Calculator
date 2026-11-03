import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { normalizeMobile, amountInCents, crc16, createPayNowPayload } from '../src/process/paynow.mjs';
import { normalizeMember } from '../src/process/storage.mjs';
import { calculateAmount } from '../src/process/calculate.js';

function fields(text) {
  const parsed = {};
  for (let offset = 0; offset < text.length;) {
    const tag = text.slice(offset, offset + 2);
    const length = Number(text.slice(offset + 2, offset + 4));
    assert.ok(length > 0 && offset + 4 + length <= text.length);
    assert.equal(parsed[tag], undefined, `Duplicate tag ${tag}`);
    parsed[tag] = text.slice(offset + 4, offset + 4 + length);
    offset += length + 4;
  }
  return parsed;
}

test('normalize Singapore mobile formats; reject invalid or foreign proxies', () => {
  for (const input of ['91234567', '+65 9123 4567', '6591234567', '(+65) 9123-4567']) {
    assert.equal(normalizeMobile(input), '+6591234567');
  }
  for (const input of ['', '61234567', '123', '+6091234567', '912345678', '9e7', '<script>']) {
    assert.throws(() => normalizeMobile(input));
  }
});

test('amounts are exact cents, not rounded into a different payment', () => {
  assert.equal(amountInCents(0.29), 29);
  assert.equal(amountInCents(-20.15), -2015);
  for (const amount of ['', null, true, NaN, Infinity, 1.001, '20.009', 1000000000]) {
    assert.throws(() => amountInCents(amount));
  }
  for (const amount of [0, -1]) {
    assert.throws(() => createPayNowPayload({ mobile: '91234567', amount }));
  }
});

test('CRC matches published CCITT-FALSE check value', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('PayNow payload preserves recipient and amount through real QR encoding/decoding', async () => {
  for (const amount of [0.01, 0.29, 20, 1234.56]) {
    const payload = createPayNowPayload({ mobile: '91234567', amount });
    const png = PNG.sync.read(await QRCode.toBuffer(payload, { width: 600, margin: 4, errorCorrectionLevel: 'M' }));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded?.data, payload);
    const root = fields(decoded.data);
    assert.equal(root['00'], '01');
    assert.equal(root['01'], '12');
    assert.deepEqual(fields(root['26']), { '00': 'SG.PAYNOW', '01': '0', '02': '+6591234567', '03': '0' });
    assert.equal(root['53'], '702');
    assert.equal(root['54'], amount.toFixed(2));
    assert.equal(root['58'], 'SG');
    assert.equal(root['63'], crc16(payload.slice(0, -4)));
  }
});

test('duplicate names still map payments to the correct recipient mobile', () => {
  const players = [
    { player: 'Alex', value: 10, mobile: '91234567' },
    { player: 'Alex', value: 20, mobile: '81234567' },
    { player: 'Ben', value: -30 },
  ];
  const result = calculateAmount(players);
  assert.deepEqual(result.payments.map((payment) => [payment.toIndex, payment.amount]), [[0, 10], [1, 20]]);
  const second = fields(createPayNowPayload({ mobile: players[result.payments[1].toIndex].mobile, amount: result.payments[1].amount }));
  assert.equal(fields(second['26'])['02'], '+6581234567');
  assert.deepEqual(players.map((player) => player.value), [10, 20, -30]);
});

test('unbalanced or fractional-cent sessions cannot produce payment instructions', () => {
  assert.ok(calculateAmount([{ value: 10 }, { value: -9 }]).error);
  assert.ok(calculateAmount([{ value: 0.001 }, { value: -0.001 }]).error);
  assert.equal(calculateAmount([{ value: 0.3 }, { value: -0.1 }, { value: -0.2 }]).payments.length, 2);
});

test('legacy groups migrate without dropping names; new groups preserve mobile numbers', () => {
  assert.deepEqual(normalizeMember('Alex'), { name: 'Alex', mobile: '' });
  assert.deepEqual(normalizeMember({ name: 'Alex', mobile: '+6591234567' }), { name: 'Alex', mobile: '+6591234567' });
});
