import { navigateTo } from '../router';
import { calculateAmount } from '../process/calculate';
import { icon, shell } from '../components/layout';

export function resultsPage() {
  const app = document.getElementById('app');
  const playersData = JSON.parse(localStorage.getItem('playersData') || '[]');
  const result = calculateAmount(playersData);

  if (result.error) {
    navigateTo('/');
    return;
  }

  app.innerHTML = shell(`
    <section class="results-hero">
      <div class="success-icon">${icon('check')}</div>
      <p class="step-label">Ready to settle</p>
      <h1>${result.payments.length} simple payment${result.payments.length === 1 ? '' : 's'}.</h1>
      <p>That’s all it takes to bring every balance back to zero.</p>
    </section>
    <section class="results-card">
      <div class="card-heading"><div><h2>Payment plan</h2><p>Work through this list from top to bottom.</p></div><span class="balance-pill is-balanced">Balanced</span></div>
      <div class="payment-list">
        ${result.payments.map((payment, index) => `
          <article class="payment-row">
            <span class="payment-number">${String(index + 1).padStart(2, '0')}</span>
            <div><strong>${escapeHtml(payment.from)}</strong><span>pays</span><strong>${escapeHtml(payment.to)}</strong></div>
            <b>$${payment.amount.toFixed(2)}</b>
          </article>`).join('') || '<div class="all-set">Everyone is already settled — no payments needed.</div>'}
      </div>
      <div class="result-actions">
        <button id="copyButton" class="secondary-button" type="button">Copy summary</button>
        <button id="backButton" class="primary-button" type="button">Start over ${icon('arrow')}</button>
      </div>
    </section>
    <section class="balance-summary">
      <h2>Group balances</h2>
      <div>${playersData.map((player) => `<span><b>${escapeHtml(player.player)}</b><em class="${player.value >= 0 ? 'positive' : ''}">${formatCurrency(player.value)}</em></span>`).join('')}</div>
    </section>
  `);

  document.getElementById('backButton').addEventListener('click', () => navigateTo('/'));
  document.getElementById('copyButton').addEventListener('click', async (event) => {
    const summary = result.payments.map((payment) => `${payment.from} pays ${payment.to} $${payment.amount.toFixed(2)}`).join('\n');
    await navigator.clipboard.writeText(summary || 'Everyone is already settled.');
    event.currentTarget.textContent = 'Copied!';
    setTimeout(() => { event.currentTarget.textContent = 'Copy summary'; }, 1600);
  });
}

function formatCurrency(value) {
  return `${value < 0 ? '−' : '+'}$${Math.abs(value).toFixed(2)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
