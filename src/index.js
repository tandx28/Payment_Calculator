import { inject } from '@vercel/analytics';
import { initRouter } from './router';
import './styles.css';

if (localStorage.getItem('settle-analytics') !== 'disabled') {
  inject({
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    beforeSend: (event) => {
      // Shared table IDs and invitation fragments must never reach analytics.
      const url = new URL(event.url);
      if (url.pathname.startsWith('/session/')) url.pathname = '/session/room';
      url.search = '';
      url.hash = '';
      return { ...event, url: url.toString() };
    },
  });
}

initRouter();
