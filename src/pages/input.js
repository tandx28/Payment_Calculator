import { navigateTo } from '../router';
import { icon, shell } from '../components/layout';

const defaultPlayers = [
  { name: '', value: '' },
  { name: '', value: '' },
  { name: '', value: '' },
];

const DRAFT_KEY = 'playersDraft';
const GROUPS_KEY = 'settle-groups';
const ACTIVE_GROUP_KEY = 'settle-active-group';

export function inputPage() {
  document.title = 'Settle — Group payment calculator';
  const app = document.getElementById('app');
  const saved = readStorage(DRAFT_KEY, null);
  const players = Array.isArray(saved) && saved.length >= 2 ? saved : defaultPlayers;
  let groups = readGroups();

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
          <p>Choose + for money owed to someone, or − for money they owe.</p>
        </div>
        <div class="balance-pill" id="balancePill">Balance <strong>$0.00</strong></div>
      </div>

      <div class="group-panel">
        <div class="group-copy">
          <span class="group-icon">${icon('shield')}</span>
          <div><strong>Your groups</strong><small>Saved only on this device</small></div>
        </div>
        <div class="group-controls">
          <select id="groupSelect" aria-label="Saved group"></select>
          <button class="compact-button" id="saveGroupButton" type="button">Save group</button>
          <button class="icon-button group-delete" id="deleteGroupButton" type="button" aria-label="Delete selected group" disabled>${icon('trash')}</button>
        </div>
        <p id="groupStatus" class="group-status" role="status"></p>
      </div>

      <form id="playerForm" novalidate>
        <div class="field-labels" aria-hidden="true"><span>Person</span><span>+/−</span><span>Balance (SGD)</span><span></span></div>
        <div id="playerInputs" class="player-list"></div>
        <button class="add-button" id="addPlayer" type="button">${icon('plus')} Add another person</button>
        <div id="errorMessage" class="error-message" role="alert" hidden></div>
        <button class="primary-button" type="submit">Calculate payments ${icon('arrow')}</button>
        <p class="privacy-note">${icon('shield')} Sessions and groups stay in this browser. No account required.</p>
      </form>

      <dialog id="groupDialog" class="group-dialog">
        <form method="dialog" id="groupForm">
          <p class="step-label">Save this group</p>
          <h2>Play together again.</h2>
          <p>Give this group a name. Member names will be saved; balances will not.</p>
          <label>Group name<input id="groupName" maxlength="40" autocomplete="off" placeholder="e.g. Friday Mahjong" required></label>
          <div class="dialog-actions">
            <button class="secondary-button" value="cancel" type="button" id="cancelGroupButton">Cancel</button>
            <button class="primary-button" value="save" type="submit">Save group</button>
          </div>
        </form>
      </dialog>
    </section>

    <section class="how-it-works" aria-labelledby="how-title">
      <p class="step-label">How it works</p>
      <h2 id="how-title">From balances to settled in three steps.</h2>
      <div class="steps">
        <article><span>01</span><h3>Pick your group</h3><p>Load saved players or enter new names. Your session is remembered automatically.</p></article>
        <article><span>02</span><h3>Set each balance</h3><p>Tap + or −, enter the amount, and make sure the group total is zero.</p></article>
        <article><span>03</span><h3>Make the payments</h3><p>Get a clean, minimal list showing exactly who pays whom.</p></article>
      </div>
    </section>
  `);

  const playerInputs = document.getElementById('playerInputs');
  const errorMessage = document.getElementById('errorMessage');
  const groupSelect = document.getElementById('groupSelect');
  const groupStatus = document.getElementById('groupStatus');
  const groupDialog = document.getElementById('groupDialog');
  const groupName = document.getElementById('groupName');
  const deleteGroupButton = document.getElementById('deleteGroupButton');

  function readRows() {
    return [...playerInputs.querySelectorAll('.player-row')].map((row) => {
      const amount = row.querySelector('[name="value"]').value;
      const multiplier = row.dataset.sign === '-' ? -1 : 1;
      return {
        name: row.querySelector('[name="name"]').value,
        value: amount === '' ? '' : String(multiplier * Number(amount)),
      };
    });
  }

  function updateBalance() {
    const total = readRows().reduce((sum, player) => sum + (Number(player.value) || 0), 0);
    const pill = document.getElementById('balancePill');
    pill.innerHTML = `Balance <strong>${formatCurrency(total)}</strong>`;
    pill.classList.toggle('is-balanced', Math.abs(total) < 0.005);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(readRows()));
  }

  function renderRows(data) {
    playerInputs.innerHTML = '';
    data.forEach((player, index) => {
      const numericValue = Number(player.value);
      const sign = player.value !== '' && numericValue < 0 ? '-' : '+';
      const amount = player.value === '' ? '' : Math.abs(numericValue);
      const row = document.createElement('div');
      row.className = 'player-row';
      row.dataset.sign = sign;
      row.innerHTML = `
        <label><span class="mobile-label">Person</span><input name="name" type="text" maxlength="40" autocomplete="off" placeholder="Name" value="${escapeHtml(player.name)}" aria-label="Person ${index + 1} name"></label>
        <button class="sign-toggle ${sign === '-' ? 'is-negative' : ''}" type="button" aria-label="Person ${index + 1} balance sign: ${sign === '-' ? 'negative' : 'positive'}" aria-pressed="${sign === '-'}">${sign === '-' ? '−' : '+'}</button>
        <label class="money-input"><span class="mobile-label">Balance (SGD)</span><span class="currency">$</span><input name="value" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${escapeHtml(amount)}" aria-label="Person ${index + 1} balance amount"></label>
        <button class="icon-button" type="button" aria-label="Remove person ${index + 1}" ${data.length <= 2 ? 'disabled' : ''}>${icon('trash')}</button>`;

      row.querySelector('.sign-toggle').addEventListener('click', (event) => {
        row.dataset.sign = row.dataset.sign === '-' ? '+' : '-';
        event.currentTarget.textContent = row.dataset.sign === '-' ? '−' : '+';
        event.currentTarget.classList.toggle('is-negative', row.dataset.sign === '-');
        event.currentTarget.setAttribute('aria-pressed', String(row.dataset.sign === '-'));
        event.currentTarget.setAttribute('aria-label', `Person ${index + 1} balance sign: ${row.dataset.sign === '-' ? 'negative' : 'positive'}`);
        updateBalance();
      });
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

  function renderGroups(selectedId = localStorage.getItem(ACTIVE_GROUP_KEY) || '') {
    groupSelect.innerHTML = `<option value="">Choose a saved group</option>${groups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}`;
    deleteGroupButton.disabled = !groupSelect.value;
  }

  groupSelect.addEventListener('change', () => {
    const group = groups.find((item) => item.id === groupSelect.value);
    deleteGroupButton.disabled = !group;
    if (!group) {
      localStorage.removeItem(ACTIVE_GROUP_KEY);
      return;
    }
    const members = group.members.map((name) => ({ name, value: '' }));
    renderRows(members.length >= 2 ? members : defaultPlayers);
    localStorage.setItem(ACTIVE_GROUP_KEY, group.id);
    showGroupStatus(`${group.name} loaded. Add this round’s balances.`);
  });

  document.getElementById('saveGroupButton').addEventListener('click', () => {
    const selected = groups.find((group) => group.id === groupSelect.value);
    groupName.value = selected?.name || '';
    groupDialog.showModal();
    groupName.focus();
  });

  document.getElementById('cancelGroupButton').addEventListener('click', () => groupDialog.close());
  groupName.addEventListener('input', () => groupName.setCustomValidity(''));

  document.getElementById('groupForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = groupName.value.trim();
    const members = readRows().map((player) => player.name.trim()).filter(Boolean);
    if (!name || members.length < 2) {
      groupName.setCustomValidity(!name ? 'Enter a group name.' : 'Add names for at least two people first.');
      groupName.reportValidity();
      return;
    }
    groupName.setCustomValidity('');
    const selectedId = groupSelect.value;
    const existingIndex = groups.findIndex((group) => group.id === selectedId || group.name.toLowerCase() === name.toLowerCase());
    const savedGroup = { id: existingIndex >= 0 ? groups[existingIndex].id : `group-${Date.now()}`, name, members };
    if (existingIndex >= 0) groups[existingIndex] = savedGroup;
    else groups.push(savedGroup);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    localStorage.setItem(ACTIVE_GROUP_KEY, savedGroup.id);
    renderGroups(savedGroup.id);
    groupDialog.close();
    showGroupStatus(`${name} saved with ${members.length} people.`);
  });

  deleteGroupButton.addEventListener('click', () => {
    const group = groups.find((item) => item.id === groupSelect.value);
    if (!group || !window.confirm(`Delete the saved group “${group.name}”?`)) return;
    groups = groups.filter((item) => item.id !== group.id);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    localStorage.removeItem(ACTIVE_GROUP_KEY);
    renderGroups('');
    showGroupStatus(`${group.name} was removed. Your current session is unchanged.`);
  });

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

  function showGroupStatus(message) {
    groupStatus.textContent = message;
  }

  renderGroups();
  renderRows(players);
}

function readGroups() {
  const groups = readStorage(GROUPS_KEY, []);
  return Array.isArray(groups) ? groups.filter((group) => group && group.id && group.name && Array.isArray(group.members)) : [];
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function formatCurrency(value) {
  const sign = value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
