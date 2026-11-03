// EMVCo Merchant-Presented Mode TLV, with the SG.PAYNOW mobile proxy template.
// No network calls: QR payloads contain only the recipient proxy and amount.
export function normalizeMobile(value = '') {
  const compact = String(value).trim().replace(/[\s()-]/g, '');
  const local = compact.replace(/^(?:\+65|65)/, '');
  if (!/^[89]\d{7}$/.test(local)) throw new Error('Use an 8-digit Singapore mobile number starting with 8 or 9.');
  return `+65${local}`;
}

export function amountInCents(value) {
  const number = Number(value);
  const cents = Math.round(number * 100);
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(number) || !Number.isSafeInteger(cents)
      || Math.abs(number * 100 - cents) > 0.00001 || Math.abs(cents) > 99999999999) {
    throw new Error('Use a valid SGD amount with at most two decimal places (up to $999,999,999.99).');
  }
  return cents;
}

export function crc16(text) {
  let crc = 0xffff;
  for (let index = 0; index < text.length; index += 1) {
    crc ^= text.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function field(id, value) {
  if (!value.length || value.length > 99) throw new Error('Invalid payment QR field.');
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

export function createPayNowPayload({ mobile, amount }) {
  const proxy = normalizeMobile(mobile);
  const cents = amountInCents(amount);
  if (cents <= 0) throw new Error('A payment QR needs an amount greater than $0.00.');
  const account = field('00', 'SG.PAYNOW') + field('01', '0')
    + field('02', proxy) + field('03', '0');
  const payload = field('00', '01') + field('01', '12') + field('26', account)
    + field('52', '0000') + field('53', '702') + field('54', (cents / 100).toFixed(2))
    + field('58', 'SG') + field('59', 'NA') + field('60', 'Singapore') + '6304';
  return payload + crc16(payload);
}
