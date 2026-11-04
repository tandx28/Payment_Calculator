import { inputPage } from './pages/input';
import { resultsPage } from './pages/results';
import { legalPage } from './pages/legal';
import { createSessionPage, sessionPage } from './pages/session';
import { installPage } from './pwa';

const routes = {
  '/': inputPage,
  '/input': inputPage,
  '/results': resultsPage,
  '/privacy': () => legalPage('privacy'),
  '/cookies': () => legalPage('cookies'),
  '/terms': () => legalPage('terms'),
  '/sessions': createSessionPage,
  '/install': installPage,
};

let cleanup;

export function router() {
  cleanup?.();
  const room = window.location.pathname.match(/^\/session\/([a-f0-9]{32})$/);
  const route = room ? () => sessionPage(room[1]) : routes[window.location.pathname] || inputPage;
  cleanup = route();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function initRouter() {
  window.addEventListener('popstate', router);
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-link]');
    if (!link) return;
    event.preventDefault();
    navigateTo(link.getAttribute('href'));
  });
  router();
}

export function navigateTo(route) {
  window.history.pushState({}, '', route);
  router();
}
