export function icon(name) {
  const icons = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5m6 6-6-6 6-6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
    shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    sparkle: '<path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"/><path d="m19 16 .6 2.1L22 19l-2.4.9L19 22l-.6-2.1L16 19l2.4-.9L19 16Z"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

export function shell(content, { compact = false } = {}) {
  return `
    <div class="site-shell">
      <header class="topbar">
        <a class="brand" href="/" data-link aria-label="Settle home">
          <span class="brand-mark">S</span><span>Settle</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="/" data-link>Calculator</a>
          <a href="/privacy" data-link>Privacy</a>
        </nav>
      </header>
      <main class="${compact ? 'legal-main' : ''}">${content}</main>
      <footer>
        <a class="brand brand--small" href="/" data-link><span class="brand-mark">S</span><span>Settle</span></a>
        <p>Game nights settled. No account needed.</p>
        <div class="footer-links">
          <a href="/privacy" data-link>Privacy</a>
          <a href="/cookies" data-link>Cookies</a>
          <a href="/terms" data-link>Terms</a>
        </div>
        <p class="copyright">© ${new Date().getFullYear()} Settle</p>
      </footer>
    </div>`;
}
