import { amountInCents } from './paynow.mjs';

function integer(value, label, minimum, maximum) {
  const n = Number(value);
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isSafeInteger(n) || n < minimum || n > maximum) throw new Error(`${label} must be a whole number from ${minimum.toLocaleString('en-SG')} to ${maximum.toLocaleString('en-SG')}.`);
  return n;
}

export function chipSettings(input = {}) {
  const mode = input.mode ?? 'cash';
  if (!['cash', 'poker', 'mahjong'].includes(mode)) throw new Error('Choose cash results, poker chips, or mahjong chips.');
  if (mode === 'cash') return { mode };
  const chipsPerBuyIn = integer(input.chipsPerBuyIn, 'Starting chips', 1, 1000000);
  const buyInCents = amountInCents(input.buyInAmount);
  if (buyInCents <= 0) throw new Error('Buy-in amount must be greater than $0.00.');
  return { mode, chipsPerBuyIn, buyInCents };
}

export function chipEntry(settings, input) {
  const buyIns = integer(input.buyIns ?? 1, 'Buy-ins (including the first)', 1, 1000);
  if (settings.mode === 'mahjong' && buyIns !== 1) throw new Error('Mahjong uses one equal starting stack per player. Extra buy-ins are only available for poker.');
  const finalChips = integer(input.finalChips, 'Final chips', 0, 1000000000);
  const delta = finalChips - settings.chipsPerBuyIn * buyIns;
  const cents = Number((BigInt(delta) * BigInt(settings.buyInCents) * 2n + (delta < 0 ? -1n : 1n) * BigInt(settings.chipsPerBuyIn)) / (2n * BigInt(settings.chipsPerBuyIn)));
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 99999999999) throw new Error('This chip result exceeds the supported SGD limit. Check your chips and buy-ins.');
  return { finalChips, buyIns, delta, cents };
}

export function chipTally(settings, entries) {
  let issued = 0, counted = 0, missing = 0;
  for (const entry of entries) {
    const buyIns = integer(entry.buyIns ?? 1, 'Buy-ins (including the first)', 1, 1000);
    if (settings.mode === 'mahjong' && buyIns !== 1) throw new Error('Mahjong uses one equal starting stack per player.');
    issued += settings.chipsPerBuyIn * buyIns;
    if (entry.finalChips === '' || entry.finalChips === null || entry.finalChips === undefined) missing += 1;
    else counted += integer(entry.finalChips, 'Final chips', 0, 1000000000);
  }
  return { issued, counted, missing, difference: counted - issued };
}

export function settleChips(settings, entries) {
  const players = entries.map((entry) => chipEntry(settings, entry));
  const tally = chipTally(settings, players);
  if (tally.difference !== 0) throw new Error(`Chips don’t tally: ${tally.issued.toLocaleString('en-SG')} issued, ${tally.counted.toLocaleString('en-SG')} counted — ${Math.abs(tally.difference).toLocaleString('en-SG')} ${tally.difference < 0 ? 'missing' : 'extra'}. Check final chips${settings.mode === 'poker' ? ' and all buy-ins' : ''}.`);
  // Allocate exact rational chip values into cents using largest remainders.
  // Stable roster order breaks ties. Every amount is within one cent of exact value.
  const denominator = BigInt(settings.chipsPerBuyIn);
  const parts = players.map((player, index) => {
    const numerator = BigInt(player.delta) * BigInt(settings.buyInCents);
    let floor = numerator / denominator;
    if (numerator < 0n && numerator % denominator !== 0n) floor -= 1n;
    return { index, floor: Number(floor), remainder: numerator - floor * denominator };
  });
  const cents = parts.map((part) => part.floor);
  const remaining = -cents.reduce((sum, value) => sum + value, 0);
  const ranked = [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; i < remaining; i += 1) cents[ranked[i].index] += 1;
  if (cents.some((value) => Math.abs(value) > 99999999999)) throw new Error('A final SGD result exceeds the supported limit. Check your chip settings.');
  return { cents, ...tally, fractionalCents: parts.some((part) => part.remainder !== 0n) };
}
