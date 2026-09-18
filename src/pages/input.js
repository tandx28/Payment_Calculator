import { navigateTo } from '../router';
import { icon, shell } from '../components/layout';

const defaultPlayers = [
  { name: '', value: '' },
  { name: '', value: '' },
  { name: '', value: '' },
];

export function inputPage() {
  const app = document.getElementById('app');
  const saved = JSON.parse(localStorage.getItem('playersDraft') || 'null');
  const players = Array.isArray(saved) && saved.length >= 2 ? saved : defaultPlayers;

  app.innerHTML = shell(`
    <section class="hero">
      <div class="eyebrow">${icon('sparkle')} Group payments, simplified</div>
      <h1>Settle up.<br><span>Stay friends.</span></h1>
      <p>Turn a messy list of wins and losses into the fewest clear payments — in seconds.</p>
      <div class="trust-row">
        <span>${icon('shield')} Private by design</span>
        <span>No sign-up</span>
        <span>Free to use</span>
      </div>
    </section>

    <section class="calculator-card" aria-labelledby="calculator-title">
      <div class="card-heading">
        <div>
          <p class="step-label">Step 1 of 1</p>
          <h2 id="calculator-title">Add everyone’s balance</h2>
          <p>Use a positive amount for money owed to them, and negative for money they owe.</p>
        </div>
        <div class="balance-pill" id="balancePill">Balance <strong>$0.00</strong></div>
      </div>

      <form id="playerForm" novalidate>
        <div class="field-labels" aria-hidden="true"><span>Person</span><span>Balance (SGD)</span><span></span></div>
        <div id="playerInputs" class="player-list"></div>
        <button class="add-button" id="addPlayer" type="button">${icon('plus')} Add another person</button>
        <div id="errorMessage" class="error-message" role="alert" hidden></div>
        <button class="primary-button" type="submit">Calculate payments ${icon('arrow')}</button>
        <p class="privacy-note">${icon('shield')} Your data stays on this device and is never sent to us.</p>
      </form>
    </section>

    <section class="how-it-works" aria-labelledby="how-title">
      <p class="step-label">How it works</p>
      <h2 id="how-title">From balances to settled in three steps.</h2>
      <div class="steps">
        <article><span>01</span><h3>Add the group</h3><p>Enter each person’s name and their final win or loss.</p></article>
        <article><span>02</span><h3>Check the balance</h3><p>The group total should be zero before calculating.</p></article>
        <article><span>03</span><h3>Make the payments</h3><p>Get a clean, minimal list showing exactly who pays whom.</p></article>
      </div>
    </section>
  `);

  const playerInputs = document.getElementById('playerInputs');
  const errorMessage = document.getElementById('errorMessage');

  function readRows() {
    return [...playerInputs.querySelectorAll('.player-row')].map((row) => ({
      name: row.querySelector('[name="name"]').value,
      value: row.querySelector('[name="value"]').value,
    }));
  }

  function updateBalance() {
    const total = readRows().reduce((sum, player) => sum + (Number(player.value) || 0), 0);
    const pill = document.getElementById('balancePill');
    pill.innerHTML = `Balance <strong>${formatCurrency(total)}</strong>`;
    pill.classList.toggle('is-balanced', Math.abs(total) < 0.005);
    localStorage.setItem('playersDraft', JSON.stringify(readRows()));
  }

  function renderRows(data) {
    playerInputs.innerHTML = '';
    data.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <label><span class="mobile-label">Person</span><input name="name" type="text" maxlength="40" autocomplete="off" placeholder="Name" value="${escapeHtml(player.name)}" aria-label="Person ${index + 1} name"></label>
        <label class="money-input"><span class="mobile-label">Balance (SGD)</span><span class="currency">$</span><input name="value" type="number" step="0.01" inputmode="decimal" placeholder="0.00" value="${escapeHtml(player.value)}" aria-label="Person ${index + 1} balance"></label>
        <button class="icon-button" type="button" aria-label="Remove person ${index + 1}" ${data.length <= 2 ? 'disabled' : ''}>${icon('trash')}</button>`;
      row.querySelector('.icon-button').addEventListener('click', () => {
        const next = readRows();
        next.splice(index, 1);
        renderRows(next);
      });
      playerInputs.appendChild(row);
    });
    playerInputs.querySelectorAll('input').forEach((input) => input.addEventListener('input', updateBalance));
    updateBalance();
  }

  document.getElementById('addPlayer').addEventListener('click', () => {
    const next = readRows();
    next.push({ name: '', value: '' });
    renderRows(next);
    playerInputs.lastElementChild.querySelector('[name="name"]').focus();
  });

  document.getElementById('playerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const rows = readRows();
    const playersData = rows.map((player, index) => ({
      player: player.name.trim() || `Person ${index + 1}`,
      value: Number(player.value),
    }));
    const total = playersData.reduce((sum, player) => sum + player.value, 0);

    if (rows.some((player) => player.value === '' || !Number.isFinite(Number(player.value)))) {
      showError('Add a valid balance for every person. Use 0 if someone broke even.');
      return;
    }
    if (playersData.every((player) => player.value === 0)) {
      showError('Add at least one non-zero balance to calculate payments.');
      return;
    }
    if (Math.abs(total) >= 0.005) {
      showError(`The balances must add up to $0.00. They are currently off by ${formatCurrency(total)}.`);
      return;
    }

    errorMessage.hidden = true;
    localStorage.setItem('playersData', JSON.stringify(playersData));
    navigateTo('/results');
  });

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  renderRows(players);
}

function formatCurrency(value) {
  const sign = value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
