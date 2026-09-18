import { shell, icon } from '../components/layout';

const updated = '18 September 2026';

const pages = {
  privacy: {
    eyebrow: 'Privacy policy',
    title: 'Your numbers are yours.',
    intro: 'Settle is designed to calculate group payments without accounts, profiles, or storing your financial details on a server.',
    sections: [
      ['What we process', 'Names and balances you enter are processed locally in your browser and saved in your device’s local storage so you can return to your calculation. Do not enter sensitive personal information.'],
      ['Analytics', 'We use Vercel Web Analytics to understand aggregate visits and page views. It is designed without cookies and does not show us individual visitor identities. You can disable analytics from the Cookie Policy.'],
      ['Hosting and service data', 'Vercel hosts this website and may process technical request data such as IP addresses, device information, and timestamps for security, delivery, and reliability. Their handling of that data is governed by Vercel’s own privacy terms.'],
      ['Retention and control', 'Calculation data remains on your device until you clear your browser storage. Analytics data follows the retention settings of the site’s Vercel account.'],
      ['Contact', 'For privacy questions, open an issue in the project’s GitHub repository. Please do not include private financial information in a public issue.'],
    ],
  },
  cookies: {
    eyebrow: 'Cookie policy',
    title: 'No tracking cookies.',
    intro: 'Settle does not use advertising cookies or cross-site tracking. It uses browser storage only to make the calculator work and remember your preference.',
    sections: [
      ['Local storage', 'We store your current calculation under playersDraft and playersData, and your analytics preference under settle-analytics. Local storage stays on your device and is not a cookie.'],
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
      ['The service', 'Settle provides estimates for simplifying payments within a group. It is an informational calculation tool, not a payment processor, bank, accountant, or financial adviser.'],
      ['Your responsibility', 'You are responsible for checking all names, balances, currencies, and payment instructions before sending money. Only enter information you have the right to use.'],
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
