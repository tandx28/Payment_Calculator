import { shell } from '../components/layout';
import { paymentDialogMarkup, setupPaymentDialog } from '../components/payment-qr';
import { calculateAmount } from '../process/calculate';
import { navigateTo } from '../router';
import { readStorage } from '../process/storage.mjs';
import QRCode from 'qrcode';
import { createPayNowPayload } from '../process/paynow.mjs';

const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (cents) => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const key = (id) => `settle-room:${id}`;
const saveAccess = (id, access) => localStorage.setItem(key(id), JSON.stringify(access));

async function request(id, token, input, signal) {
  const response = await fetch(`/api/sessions${id ? `?id=${encodeURIComponent(id)}` : '?action=health'}`, {
    method: input ? 'POST' : 'GET',
    headers: { ...(input ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: input ? JSON.stringify({ ...input, analytics: localStorage.getItem('settle-analytics') !== 'disabled' }) : undefined, cache: 'no-store', signal,
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Unable to reach your table.'); error.status = response.status; throw error; }
  return data;
}

export function createSessionPage() {
  document.title = 'Host a shared table — Settle';
  document.getElementById('app').innerHTML = shell(`
    <section class="shared-intro"><p class="step-label">Same table. Everyone’s phone.</p><h1>Get the kakis in.</h1>
      <p>Share a link or let your kakis scan the invite QR. Once everyone joins, the host starts the round. Each person submits their result with one tap. When everyone’s ready and the table adds up to $0, the payment plan appears.</p></section>
    <section class="calculator-card shared-create"><h2>Host a table</h2>
      <form id="createSessionForm">
        <label>Table name<input name="title" maxlength="40" value="Tonight’s table" required></label>
        <label>Your name<input name="name" maxlength="40" autocomplete="off" placeholder="What your kakis call you" required></label>
        <label>Your PayNow mobile (optional)<input name="mobile" type="tel" maxlength="24" inputmode="tel" autocomplete="off" placeholder="8-digit Singapore mobile"></label>
        <p class="shared-disclosure">Shared tables sync names and results through our server for 24 hours. PayNow numbers are revealed to the table when results unlock. Anyone with the invite can join while the lobby is open. No account needed.</p>
        <p id="createSessionStatus" role="status">Checking session storage…</p>
        <button id="createSessionButton" class="primary-button" disabled>Create table & get invite link</button>
      </form>
      <a class="back-link shared-back" href="/" data-link>Use the solo calculator</a>
    </section>`);
  const status = document.getElementById('createSessionStatus');
  const button = document.getElementById('createSessionButton');
  let active = true;
  request().then((health) => {
    if (!active) return;
    button.disabled = !health.available;
    status.textContent = health.available ? 'No sign-up. Keep using this browser to retain host access.' : 'Shared tables are waiting for a database connection. The solo calculator is available now.';
  }).catch(() => { if (active) status.textContent = 'Session storage is unavailable right now. Try again later or use the solo calculator.'; });
  document.getElementById('createSessionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = 'Creating your table…';
    try {
      const fields = new FormData(event.currentTarget);
      const room = await request(null, null, { action: 'create', title: fields.get('title'), name: fields.get('name'), mobile: fields.get('mobile') });
      saveAccess(room.id, { token: room.token, inviteToken: room.inviteToken });
      if (active) navigateTo(`/session/${room.id}`);
    } catch (error) {
      if (active) { status.textContent = error.message; button.disabled = false; }
    }
  });
  return () => { active = false; };
}

export function sessionPage(id) {
  document.title = 'Shared table — Settle';
  let access = readStorage(key(id), {});
  const invitation = new URLSearchParams(location.hash.slice(1)).get('invite');
  if (invitation && /^[a-f0-9]{48}$/.test(invitation)) {
    access.inviteToken = invitation;
    saveAccess(id, access);
  }
  // The invitation is in a fragment, never a query string or referrer. Remove after saving locally.
  if (location.hash) history.replaceState({}, '', location.pathname);
  const controller = new AbortController();
  let active = true;
  let state;
  let busy = false;
  let pollTimer;
  let editorRound;
  let editorDirty = false;
  document.getElementById('app').innerHTML = shell(`
    <section class="shared-intro"><p class="step-label">Shared table</p><h1 id="roomTitle">Getting the table…</h1><p id="roomSubtitle">Updates sync automatically.</p></section>
    <section class="calculator-card room-card">
      <p id="roomMessage" class="room-message" role="status">Connecting…</p>
      <div id="joinPanel" hidden><h2>Grab a seat</h2><form id="joinForm" class="shared-create">
        <label>Your name<input name="name" maxlength="40" autocomplete="off" placeholder="Your name" required></label>
        <label>PayNow mobile (optional)<input name="mobile" type="tel" inputmode="tel" maxlength="24" autocomplete="off" placeholder="8-digit mobile"></label>
        <p class="shared-disclosure">Your name and result are shared with this table. Your PayNow number will be shared when the payment plan unlocks. Sessions expire after 24 hours. Only enter your own details.</p>
        <button class="primary-button" type="submit">Join the table</button>
      </form></div>
      <div id="tablePanel" hidden>
        <div id="hostControls" class="host-controls" hidden>
          <button id="copyInvite" class="compact-button" type="button">Copy invite link</button>
          <button id="showInviteQr" class="secondary-button" type="button" aria-expanded="false" aria-controls="inviteQrPanel">Show join QR</button>
          <button id="startRound" class="primary-button" type="button">Everyone’s here — start round</button>
          <button id="reopenTable" class="secondary-button" type="button">Reopen lobby</button>
          <button id="newRound" class="primary-button" type="button">Run it back — new round</button>
        </div>
        <section id="inviteQrPanel" class="invite-qr-panel" hidden aria-labelledby="inviteQrTitle">
          <h2 id="inviteQrTitle">Scan. Grab a seat.</h2><p>Ask your kakis to scan this with their phone camera before you start.</p>
          <canvas id="inviteQrCanvas" role="img" aria-label="Scan to join this table" hidden></canvas>
          <p id="inviteQrStatus" role="status"></p><p class="shared-disclosure">This QR contains the invite link, never your host access. Share it only with your kakis.</p>
        </section>
        <div class="room-stats"><span id="roomPhase"></span><strong id="readyCount"></strong><span id="roomTotal"></span></div>
        <p id="balanceSummary" class="balance-summary" role="status"></p>
        <div id="roomRoster" class="room-roster"></div>
        <form id="resultForm" class="shared-create own-result">
          <h2>Your result</h2><p class="shared-disclosure">Only you can edit your result. If you’re up, add your PayNow number for the payment QR.</p>
          <div class="room-result-input"><button id="roomSign" class="sign-toggle" type="button" aria-label="Result sign: positive" aria-pressed="false">+</button>
            <label>Amount (SGD)<input id="roomAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" required></label></div>
          <label>Your PayNow mobile<input id="roomMobile" type="tel" inputmode="tel" maxlength="24" autocomplete="off" placeholder="Required if you won"></label>
          <button id="submitResult" class="primary-button" type="submit">Save & ready</button>
          <button id="editResult" class="compact-button" type="button" hidden>Edit my result</button>
          <p id="ownResultStatus" class="shared-disclosure"></p>
        </form>
        <section id="sharedPayments" class="shared-payments" hidden><h2>All ready. Time to settle.</h2><p id="paymentSummary"></p><div id="sharedPaymentList"></div>
          <p class="shared-disclosure">Tap a QR to enlarge it and save the image. Open your banking app’s scanner or import from photos. Always check the bank-displayed payee and amount. Settle does not confirm payment.</p></section>
        <p class="shared-disclosure">Keep using this browser to retain your seat. This table expires <span id="roomExpiry"></span>. Share the invite only with your kakis.</p>
      </div>
    </section>${paymentDialogMarkup()}`);

  const element = (name) => document.getElementById(name);
  const message = element('roomMessage');
  const showPayment = setupPaymentDialog();
  function setSign(negative) {
    const button = element('roomSign');
    button.dataset.negative = String(negative);
    button.textContent = negative ? '−' : '+';
    button.classList.toggle('is-negative', negative);
    button.setAttribute('aria-pressed', String(negative));
    button.setAttribute('aria-label', `Result sign: ${negative ? 'negative' : 'positive'}`);
  }
  function fillEditor() {
    const person = state.members?.find((member) => member.id === state.me);
    if (!person) return;
    setSign((person.cents || 0) < 0);
    element('roomAmount').value = person.cents === null ? '' : (Math.abs(person.cents) / 100).toFixed(2);
    element('roomMobile').value = person.mobile || '';
    editorRound = state.round;
    editorDirty = false;
  }
  function render(next) {
    if (!active) return;
    if (state && next.version < state.version) return;
    const previousPhase = state?.phase;
    state = next;
    element('roomTitle').textContent = state.title;
    element('roomSubtitle').textContent = `Round ${state.round} · ${state.memberCount} at the table · updates every 5 seconds`;
    element('joinPanel').hidden = !state.needsJoin;
    element('tablePanel').hidden = Boolean(state.needsJoin);
    if (state.needsJoin) { message.textContent = state.phase === 'lobby' ? 'The lobby is open. Join using your own name.' : 'The host has locked the roster. Ask them to reopen the lobby to join.'; return; }
    const ready = state.members.filter((person) => person.ready).length;
    const total = state.members.reduce((sum, person) => sum + (person.cents || 0), 0);
    const winnings = state.members.reduce((sum, person) => sum + Math.max(person.cents || 0, 0), 0);
    const losses = state.members.reduce((sum, person) => sum + Math.max(-(person.cents || 0), 0), 0);
    const missing = state.members.filter((person) => person.cents === null).length;
    const me = state.members.find((person) => person.id === state.me);
    element('roomPhase').textContent = state.phase === 'lobby' ? 'Lobby open' : state.phase === 'settled' ? 'Payment plan unlocked' : 'Collecting results';
    element('readyCount').textContent = `${ready}/${state.members.length} ready`;
    element('roomTotal').textContent = `Net ${money(total)}`;
    element('roomTotal').className = total === 0 ? 'positive' : 'room-off-balance';
    element('balanceSummary').hidden = state.phase === 'lobby';
    element('balanceSummary').classList.toggle('room-off-balance', missing === 0 && total !== 0);
    element('balanceSummary').textContent = `Winnings: ${money(winnings)} · Losses: ${money(losses)}. ${missing ? `Waiting for ${missing} more result${missing === 1 ? '' : 's'} before checking the balance.` : total !== 0 ? `${money(Math.abs(total))} doesn’t tally — ${total > 0 ? 'winnings are higher than losses' : 'losses are higher than winnings'}. Check your amount and + / − sign, then edit and submit again.` : 'The table balances.'}`;
    element('roomRoster').innerHTML = state.members.map((person) => `<article class="roster-row"><div><strong>${escape(person.name)}</strong><small>${person.host ? 'Host' : person.id === state.me ? 'You' : 'Player'}</small></div><span>${person.cents === null ? 'Not entered' : money(person.cents)}</span><b class="${person.ready ? 'ready-badge' : 'waiting-badge'}">${person.ready ? 'Ready' : 'Not ready'}</b>${state.isHost && state.phase === 'lobby' && !person.host ? `<button class="roster-remove" data-remove="${person.id}" type="button" aria-label="Remove ${escape(person.name)}">Remove</button>` : ''}</article>`).join('');
    element('hostControls').hidden = !state.isHost;
    element('startRound').hidden = state.phase !== 'lobby';
    element('startRound').disabled = state.members.length < 2 || busy;
    element('reopenTable').hidden = state.phase !== 'collecting';
    element('newRound').hidden = state.phase !== 'settled';
    element('copyInvite').hidden = !access.inviteToken;
    element('showInviteQr').hidden = !access.inviteToken || state.phase !== 'lobby';
    if (state.phase !== 'lobby') {
      element('inviteQrPanel').hidden = true;
      element('showInviteQr').setAttribute('aria-expanded', 'false');
    }
    element('roomExpiry').textContent = new Date(state.expiresAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
    element('resultForm').hidden = state.phase !== 'collecting';
    if (editorRound !== state.round || (!editorDirty && previousPhase === 'settled')) fillEditor();
    const locked = me.ready;
    element('roomAmount').disabled = locked || busy;
    element('roomMobile').disabled = locked || busy;
    element('roomSign').disabled = locked || busy;
    element('submitResult').hidden = locked;
    element('submitResult').disabled = busy || state.phase !== 'collecting';
    element('submitResult').textContent = busy ? 'Saving…' : 'Save & ready';
    element('editResult').hidden = !locked;
    element('ownResultStatus').textContent = locked ? 'Saved. You’re ready! Use Edit my result if anything needs changing.' : 'Enter your result, then tap Save & ready. One tap saves it and tells the table you’re done.';
    message.textContent = state.phase === 'settled' ? 'Everyone is ready and the table balances. Payment plan unlocked.' : state.phase === 'lobby' ? 'Get everyone in, then the host starts the round. The player list will lock when it starts.' : ready === state.members.length && total !== 0 ? `${money(Math.abs(total))} doesn’t tally. Check the winnings and losses below; use Edit my result to fix your amount or sign.` : 'Waiting for everyone to save their result. Tap Save & ready when yours is correct.';
    element('sharedPayments').hidden = state.phase !== 'settled';
    if (state.phase === 'settled') renderPayments();
  }
  function renderPayments() {
    const players = state.members.map((person) => ({ player: person.name, value: person.cents / 100, mobile: person.mobile }));
    const result = calculateAmount(players);
    if (result.error) { element('paymentSummary').textContent = result.error; return; }
    element('paymentSummary').textContent = result.payments.length ? `${result.payments.length} payment${result.payments.length === 1 ? '' : 's'} to square the table. Your own transfers are highlighted.` : 'Everyone broke even. No payments needed.';
    element('sharedPaymentList').innerHTML = result.payments.map((payment, index) => `<article class="shared-transfer ${state.members[payment.fromIndex].id === state.me ? 'my-transfer' : ''}"><p><strong>${escape(payment.from)}</strong> pays <strong>${escape(payment.to)}</strong> <b>${money(Math.round(payment.amount * 100))}</b></p><button class="shared-qr" data-qr="${index}" type="button"><canvas width="220" height="220" aria-label="PayNow QR to ${escape(payment.to)}" role="img"></canvas><span>Tap to enlarge & save QR · Beta</span></button></article>`).join('');
    document.querySelectorAll('[data-qr]').forEach((button) => button.addEventListener('click', () => {
      const payment = result.payments[Number(button.dataset.qr)];
      showPayment(payment, players[payment.toIndex]);
    }));
    document.querySelectorAll('[data-qr]').forEach((button) => {
      const payment = result.payments[Number(button.dataset.qr)];
      try {
        QRCode.toCanvas(button.querySelector('canvas'), createPayNowPayload({ mobile: players[payment.toIndex].mobile, amount: payment.amount }), { width: 220, margin: 4, errorCorrectionLevel: 'M' }).catch(() => { button.querySelector('span').textContent = 'Tap to view payment details'; });
      } catch { button.querySelector('span').textContent = 'Tap to view payment details'; }
    });
  }
  async function refresh() {
    if (!active || busy || document.hidden) return;
    try {
      const next = await request(id, access.token || access.inviteToken, undefined, controller.signal);
      if (!state || next.version !== state.version) render(next);
    } catch (error) {
      if (active && error.name !== 'AbortError') {
        message.textContent = error.message;
        if ([401, 403, 404, 410].includes(error.status)) { clearInterval(pollTimer); element('tablePanel').hidden = true; element('joinPanel').hidden = true; }
      }
    }
  }
  async function mutate(input) {
    if (busy) return;
    busy = true;
    render(state);
    try {
      const next = await request(id, access.token || access.inviteToken, { ...input, version: state.version }, controller.signal);
      if (!active) return;
      busy = false;
      if (input.action === 'submit') { editorDirty = false; state = next; fillEditor(); }
      render(next);
    } catch (error) {
      busy = false;
      if (active && error.name !== 'AbortError') {
        const text = error.message;
        render(state);
        if (error.status === 409) await refresh();
        message.textContent = text;
      }
    }
  }
  element('joinForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const form = new FormData(event.currentTarget);
    access.pendingToken ||= randomToken();
    saveAccess(id, access);
    try {
      const next = await request(id, access.inviteToken, { action: 'join', name: form.get('name'), mobile: form.get('mobile'), playerToken: access.pendingToken }, controller.signal);
      access.token = access.pendingToken;
      delete access.pendingToken;
      saveAccess(id, access);
      busy = false;
      if (active) render(next);
    } catch (error) { busy = false; if (active) message.textContent = error.message; }
  });
  element('copyInvite').addEventListener('click', async () => {
    const link = `${location.origin}/session/${id}#invite=${access.inviteToken}`;
    try { await navigator.clipboard.writeText(link); message.textContent = 'Invite copied. Send it to your kakis — it does not include your host access.'; }
    catch { message.textContent = `Copy this invite: ${link}`; }
  });
  element('showInviteQr').addEventListener('click', async () => {
    const panel = element('inviteQrPanel');
    panel.hidden = !panel.hidden;
    element('showInviteQr').setAttribute('aria-expanded', String(!panel.hidden));
    if (panel.hidden || !access.inviteToken) return;
    const canvas = element('inviteQrCanvas');
    element('inviteQrStatus').textContent = 'Preparing invite QR…';
    try {
      await QRCode.toCanvas(canvas, `${location.origin}/session/${id}#invite=${access.inviteToken}`, { width: 360, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      if (!active) return;
      canvas.hidden = false;
      element('inviteQrStatus').textContent = 'Scan to join. No sign-up needed.';
    } catch { if (active) element('inviteQrStatus').textContent = 'Couldn’t prepare the QR. Use Copy invite link instead.'; }
  });
  element('startRound').addEventListener('click', () => mutate({ action: 'start' }));
  element('reopenTable').addEventListener('click', () => mutate({ action: 'reopen' }));
  element('newRound').addEventListener('click', () => mutate({ action: 'new-round' }));
  element('roomRoster').addEventListener('click', (event) => { const button = event.target.closest('[data-remove]'); if (button) mutate({ action: 'remove', memberId: button.dataset.remove }); });
  element('roomSign').addEventListener('click', () => { setSign(element('roomSign').dataset.negative !== 'true'); editorDirty = true; render(state); });
  [element('roomAmount'), element('roomMobile')].forEach((input) => input.addEventListener('input', () => { editorDirty = true; render(state); }));
  element('resultForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = element('roomAmount').value;
    if (amount === '' || Number(amount) < 0) { message.textContent = 'Enter a positive amount and use the + / − button for won or lost.'; return; }
    mutate({ action: 'submit', value: Number(amount) * (element('roomSign').dataset.negative === 'true' ? -1 : 1), mobile: element('roomMobile').value });
  });
  element('editResult').addEventListener('click', () => mutate({ action: 'unready' }));
  const onVisible = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  if (!access.token && !access.inviteToken) message.textContent = 'Open the full invite link from your host to join. Host access stays on the browser that created the table.';
  else { refresh(); pollTimer = setInterval(refresh, 5000); }
  return () => { active = false; clearInterval(pollTimer); controller.abort(); document.removeEventListener('visibilitychange', onVisible); };
}
