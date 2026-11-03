import { shell, icon } from '../components/layout';

const updated = '3 November 2026';

const pages = {
  privacy: {
    eyebrow: 'Privacy policy',
    title: 'Your numbers are yours.',
    intro: 'Settle works without accounts. The solo calculator stays on your device; shared tables sync the information needed for your friends to settle together.',
    sections: [
      ['Solo calculator', 'Names, balances, optional PayNow mobile numbers, and saved groups in the solo calculator stay in your browser. Only save someone’s number with their permission. Settle does not verify that a number is registered with PayNow.'],
      ['Shared tables', 'When you create or join a shared table, your name, result, ready status, and optional PayNow number are sent to our server and stored in the connected Upstash Redis database. Table members see names, results, and ready status. Your PayNow number is shared with the table when the payment plan unlocks. Anyone holding the invite can join an open lobby. Only submit your own details.'],
      ['Payment QRs and sharing', 'Payment QRs are generated on your device without an external QR service. Each code contains the payee’s mobile number and SGD amount. Downloading or sharing it exposes those details to anyone who receives it. Payment details are not included in website URLs or analytics events.'],
      ['Analytics', 'We use Vercel Web Analytics to understand aggregate visits and page views. It is designed without cookies and does not show us individual visitor identities. You can disable analytics from the Cookie Policy.'],
      ['Hosting and service data', 'Vercel hosts this website and may process technical request data such as IP addresses, device information, and timestamps for security, delivery, and reliability. Their handling of that data is governed by Vercel’s own privacy terms.'],
      ['Retention and control', 'Shared tables expire 24 hours after creation; live session records expire from storage then. Browser credentials remain until you clear this site’s data. Solo drafts and groups remain on this device until removed. Hosting and database providers may retain operational logs or backups under their own policies. Analytics retention follows the site’s Vercel settings.'],
      ['Contact', 'For privacy questions, open an issue in the project’s GitHub repository. Please do not include private financial information in a public issue.'],
    ],
  },
  cookies: {
    eyebrow: 'Cookie policy',
    title: 'No tracking cookies.',
    intro: 'Settle does not use advertising cookies or cross-site tracking. It uses browser storage only to make the calculator work and remember your preference.',
    sections: [
      ['Local storage', 'We use local storage for solo drafts, names, optional PayNow numbers, groups, analytics preferences, and credentials that let you return to a shared table without an account. Shared-table information is also sent to server storage so your friends can see updates. Local storage is not a cookie.'],
      ['Vercel Web Analytics', 'Our audience measurement is cookieless. It provides aggregate information such as page views and visitor counts without creating advertising profiles.'],
      ['Your choices', 'You can disable analytics below. You can also remove calculator data at any time by clearing this site’s data in your browser settings.'],
    ],
    controls: true,
  },
  terms: {
    eyebrow: 'Terms of use',
    title: 'Clear terms for a simple tool.',
    intro: 'By using Settle, you agree to these terms. If you do not agree, please do not use the service.',
    sections: [
      ['The service', 'Settle helps friends calculate who pays whom after social games such as mahjong, poker, and card games. It is an informational calculator, not a gambling service, payment processor, bank, accountant, or financial adviser.'],
      ['Your responsibility', 'You are responsible for checking all names, balances, currencies, and payment instructions before sending money. Only enter information you have the right to use.'],
      ['Payment QRs', 'Generated PayNow QRs are a beta feature; compatibility has not been confirmed across banking apps. Check the bank-displayed recipient name and amount before authorising any transfer. Generating, copying, downloading, or sharing a QR does not transfer funds or confirm payment. Settle cannot determine whether a transfer succeeded.'],
      ['No warranties', 'The service is provided “as is” and “as available.” We do not guarantee uninterrupted operation or that every calculation will suit your circumstances.'],
      ['Limitation of liability', 'To the extent permitted by law, Settle’s maintainers are not liable for losses arising from use of, or reliance on, the service.'],
      ['Changes', 'We may update the service or these terms. The date below shows when this page was last revised. Continued use after an update means you accept the revised terms.'],
    ],
  },
};

export function legalPage(type) {
  const page = pages[type] || pages.privacy;
  document.title = `${page.eyebrow} — Settle`;
  document.getElementById('app').innerHTML = shell(`
    <article class="legal-page">
      <a class="back-link" href="/" data-link>${icon('back')} Back to calculator</a>
      <p class="step-label">${page.eyebrow}</p>
      <h1>${page.title}</h1>
      <p class="legal-intro">${page.intro}</p>
      <div class="legal-sections">
        ${page.sections.map(([title, text]) => `<section><h2>${title}</h2><p>${text}</p></section>`).join('')}
      </div>
      ${page.controls ? preferenceControls() : ''}
      <p class="last-updated">Last updated: ${updated}. These general terms are provided for this project and are not legal advice.</p>
    </article>
  `, { compact: true });

  const controls = document.getElementById('analyticsPreference');
  if (controls) {
    controls.addEventListener('change', (event) => {
      localStorage.setItem('settle-analytics', event.target.value);
      document.getElementById('preferenceStatus').textContent = 'Preference saved. Reload the page to apply it.';
    });
  }
}

function preferenceControls() {
  const current = localStorage.getItem('settle-analytics') || 'enabled';
  return `<section class="preference-card">
    <div><h2>Analytics preference</h2><p>Choose whether this browser contributes anonymous visit data.</p></div>
    <select id="analyticsPreference" aria-label="Analytics preference">
      <option value="enabled" ${current === 'enabled' ? 'selected' : ''}>Allow analytics</option>
      <option value="disabled" ${current === 'disabled' ? 'selected' : ''}>Disable analytics</option>
    </select>
    <span id="preferenceStatus" role="status"></span>
  </section>`;
}
