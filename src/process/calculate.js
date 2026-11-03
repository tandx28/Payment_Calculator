import { amountInCents } from './paynow.mjs';

export function calculateAmount(playersData = []) {
  if (playersData.length < 2) {
    return { error: 'Add at least two people before calculating.' };
  }

  let balances;
  try {
    balances = playersData.map((player) => amountInCents(player.value));
  } catch (error) {
    return { error: error.message };
  }
  const total = balances.reduce((sum, cents) => sum + cents, 0);
  if (total !== 0) {
    return { error: `The balances are off by $${(Math.abs(total) / 100).toFixed(2)}.` };
  }

  const creditors = playersData
    .map((player, index) => ({ ...player, index, cents: balances[index] }))
    .filter((player) => player.cents > 0);
  const debtors = playersData
    .map((player, index) => ({ ...player, index, cents: balances[index] }))
    .filter((player) => player.cents < 0)
    .map((player) => ({ ...player, cents: Math.abs(player.cents) }));

  const payments = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const cents = Math.min(creditor.cents, debtor.cents);
    payments.push({ from: debtor.player, to: creditor.player, fromIndex: debtor.index, toIndex: creditor.index, amount: cents / 100 });
    creditor.cents -= cents;
    debtor.cents -= cents;
    if (creditor.cents === 0) creditorIndex += 1;
    if (debtor.cents === 0) debtorIndex += 1;
  }

  return { payments };
}
