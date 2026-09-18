export function calculateAmount(playersData = []) {
  if (playersData.length < 2) {
    return { error: 'Add at least two people before calculating.' };
  }

  const total = playersData.reduce((sum, player) => sum + Number(player.value), 0);
  if (!playersData.every((player) => Number.isFinite(Number(player.value)))) {
    return { error: 'Every balance must be a valid number.' };
  }
  if (Math.abs(total) >= 0.005) {
    return { error: `The balances are off by $${Math.abs(total).toFixed(2)}.` };
  }

  const creditors = playersData
    .map((player, index) => ({ ...player, index, cents: Math.round(player.value * 100) }))
    .filter((player) => player.cents > 0);
  const debtors = playersData
    .map((player, index) => ({ ...player, index, cents: Math.round(player.value * 100) }))
    .filter((player) => player.cents < 0)
    .map((player) => ({ ...player, cents: Math.abs(player.cents) }));

  const payments = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const cents = Math.min(creditor.cents, debtor.cents);
    payments.push({ from: debtor.player, to: creditor.player, amount: cents / 100 });
    creditor.cents -= cents;
    debtor.cents -= cents;
    if (creditor.cents === 0) creditorIndex += 1;
    if (debtor.cents === 0) debtorIndex += 1;
  }

  return { payments };
}
