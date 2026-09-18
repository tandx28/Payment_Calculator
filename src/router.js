import { inputPage } from './pages/input';
import { resultsPage } from './pages/results';
import { legalPage } from './pages/legal';

const routes = {
  '/': inputPage,
  '/input': inputPage,
  '/results': resultsPage,
  '/privacy': () => legalPage('privacy'),
  '/cookies': () => legalPage('cookies'),
  '/terms': () => legalPage('terms'),
};

export function router() {
  const route = routes[window.location.pathname] || inputPage;
  route();
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
