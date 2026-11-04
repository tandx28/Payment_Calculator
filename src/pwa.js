import { shell } from './components/layout';

let installPrompt;
let installed = false;
let initialized = false;
const changed = () => window.dispatchEvent(new Event('settle-install-change'));

export function installState() {
  return {
    installed: installed || Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone),
    available: Boolean(installPrompt),
  };
}

export function initPwa() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = undefined;
    changed();
  });
}

export async function requestInstall() {
  const prompt = installPrompt;
  if (!prompt) return 'unavailable';
  installPrompt = undefined;
  changed();
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}

export function installPage() {
  document.title = 'Get the optional app — Settle';
  document.getElementById('app').innerHTML = shell(`
    <section class="shared-intro"><p class="step-label">Your usual table. One tap away.</p>
      <h1>Settle on your home screen.</h1><p>Add Settle to your phone for quick access in its own app window. Free, no account needed.</p></section>
    <section class="calculator-card install-card">
      <div class="install-heading"><img src="/icons/settle-192.png" width="72" height="72" alt="Settle app icon"><div><h2>Settle Lah SG</h2><p>Game nights settled.</p></div></div>
      <p>Host from the app or the website. Your kakis can join through the same link or QR in their browser — they don’t need to install anything.</p>
      <button id="installApp" class="primary-button" type="button" hidden>Add Settle to this device</button>
      <p id="installStatus" class="shared-disclosure" role="status"></p>
      <div id="installInstructions" class="install-instructions">
        <section><h3>iPhone / iPad</h3><ol><li>Open <strong>settlelah-sg.vercel.app/install</strong> in Safari.</li><li>Tap <strong>Share</strong> (it may be inside the More menu).</li><li>Choose <strong>Add to Home Screen</strong>, turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li></ol></section>
        <section><h3>Android</h3><ol><li>Open this website in Chrome.</li><li>Tap the <strong>⋮ menu</strong>, then <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li><li>Confirm to add Settle. The wording depends on your browser.</li></ol></section>
        <section><h3>On your laptop</h3><p>In a supported browser such as Chrome or Edge, use the install icon near the address bar or the browser’s app-install menu.</p></section>
      </div>
      <p class="shared-disclosure">If you opened this inside Telegram or another app, open it in Safari or Chrome to install. Shared tables need an internet connection.</p>
      <p class="shared-disclosure">For an existing table, return in the same app or browser you used to create or join it. Saved groups and host access may not transfer when you install or switch browsers. Tables still expire after 24 hours.</p>
      <a class="primary-button install-open" href="/sessions" data-link>Host a table</a>
      <a class="back-link shared-back" href="/" data-link>Keep using the website</a>
    </section>`);
  const button = document.getElementById('installApp');
  const status = document.getElementById('installStatus');
  let active = true;
  function update() {
    const state = installState();
    button.hidden = state.installed || !state.available;
    document.getElementById('installInstructions').hidden = state.installed;
    status.textContent = state.installed ? 'You’re using the app, or have just installed it. Ready to host?' : state.available ? 'Installation is optional. Your friends can keep using the website.' : 'Use your browser’s menu to add Settle, following the steps below. You can also keep using the website.';
  }
  button.addEventListener('click', async () => {
    const outcome = await requestInstall();
    if (!active) return;
    update();
    if (!installState().installed) status.textContent = outcome === 'accepted' ? 'Install request accepted. Once it finishes, look for Settle on your home screen or in your apps.' : outcome === 'dismissed' ? 'No worries. Keep using the website, or install later from your browser’s menu.' : 'Use the browser-menu steps below to add Settle.';
  });
  window.addEventListener('settle-install-change', update);
  update();
  return () => { active = false; window.removeEventListener('settle-install-change', update); };
}
