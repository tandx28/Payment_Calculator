import { navigateTo } from '../router';
import { calculateAmount } from '../process/calculate';
import { icon, shell } from '../components/layout';
import { paymentDialogMarkup, setupPaymentDialog } from '../components/payment-qr';
import { readStorage } from '../process/storage.mjs';
import { normalizeMobile } from '../process/paynow.mjs';

export function resultsPage() {
  const app = document.getElementById('app');
  const saved = readStorage('playersData', []);
  const playersData = Array.isArray(saved) ? saved : [];
  const result = calculateAmount(playersData);

  if (result.error) {
    navigateTo('/');
    return;
  }

  app.innerHTML = shell(`
    <section class="results-hero">
      <div class="success-icon">${icon('check')}</div>
      <p class="step-label">Game over</p>
      <h1>${result.payments.length} payment${result.payments.length === 1 ? '' : 's'}. Settle already.</h1>
      <p>Clear these transfers and the whole table is square.</p>
    </section>
    <section class="results-card">
      <div class="card-heading"><div><h2>Who pays who</h2><p>Send this list to the group chat and settle from top to bottom.</p></div><span class="balance-pill is-balanced">All square</span></div>
      <div class="payment-list">
        ${result.payments.map((payment, index) => `
          <article class="payment-row">
            <span class="payment-number">${String(index + 1).padStart(2, '0')}</span>
            <div><strong>${escapeHtml(payment.from)}</strong><span>pays</span><strong>${escapeHtml(payment.to)}</strong></div>
            <b>$${payment.amount.toFixed(2)}</b>
            <div class="transfer-action"><button class="compact-button pay-qr-button" type="button" data-payment="${index}">${hasMobile(playersData[payment.toIndex]) ? 'Show payment QR' : 'Add PayNow number'}</button></div>
          </article>`).join('') || '<div class="all-set">Everyone is already settled — no payments needed.</div>'}
      </div>
      <p class="payment-help">QRs include the payee’s number and exact amount. Confirm the recipient in your banking app. Settle cannot verify payment completion.</p>
      <div class="result-actions">
        <button id="copyButton" class="secondary-button" type="button">Copy for group chat</button>
        <button id="backButton" class="primary-button" type="button">Run it back ${icon('arrow')}</button>
      </div>
    </section>
    <section class="balance-summary">
      <h2>Final scores</h2>
      <div>${playersData.map((player) => `<span><b>${escapeHtml(player.player)}</b><em class="${player.value >= 0 ? 'positive' : ''}">${formatCurrency(player.value)}</em></span>`).join('')}</div>
    </section>
    ${paymentDialogMarkup()}
  `);

  const showPayment = setupPaymentDialog();
  document.querySelectorAll('.pay-qr-button').forEach((button) => button.addEventListener('click', () => {
    const payment = result.payments[Number(button.dataset.payment)];
    const recipient = playersData[payment.toIndex];
    if (!hasMobile(recipient)) {
      localStorage.setItem('playersDraft', JSON.stringify(playersData.map((player) => ({ name: player.player, mobile: player.mobile || '', value: String(player.value) }))));
      navigateTo('/');
      const field = document.querySelectorAll('input[name="mobile"]')[payment.toIndex];
      field?.focus();
      field?.scrollIntoView({ block: 'center' });
      return;
    }
    showPayment(payment, recipient);
  }));

  document.getElementById('backButton').addEventListener('click', () => {
    const nextRound = playersData.map((player) => ({ name: player.player, mobile: player.mobile || '', value: '' }));
    localStorage.setItem('playersDraft', JSON.stringify(nextRound));
    navigateTo('/');
  });
  document.getElementById('copyButton').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const summary = result.payments.map((payment) => `${payment.from} pays ${payment.to} $${payment.amount.toFixed(2)}`).join('\n');
    try {
      await navigator.clipboard.writeText(summary || 'Everyone is already settled.');
      button.textContent = 'Copied!';
    } catch {
      button.textContent = 'Copy unavailable in this browser';
    }
    setTimeout(() => { button.textContent = 'Copy for group chat'; }, 1600);
  });
}

function hasMobile(player) {
  try { return Boolean(normalizeMobile(player?.mobile)); } catch { return false; }
}

function formatCurrency(value) {
  return `${value < 0 ? '−' : '+'}$${Math.abs(value).toFixed(2)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
