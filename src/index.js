import { inject } from '@vercel/analytics';
import { initRouter } from './router';
import './styles.css';

if (localStorage.getItem('settle-analytics') !== 'disabled') {
  inject({ mode: process.env.NODE_ENV === 'production' ? 'production' : 'development' });
}

initRouter();
