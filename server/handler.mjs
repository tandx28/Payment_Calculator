import { createRoomService, digest, RoomError } from './rooms.mjs';
import { createRedisStore, redisConfig } from './redis.mjs';

export function makeHandler(store = createRedisStore(), available = Boolean(redisConfig())) {
  const service = createRoomService(store);
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    try {
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'Method not allowed.' }); }
      const url = new URL(req.url, 'https://settle.local');
      if (req.method === 'GET' && url.searchParams.get('action') === 'health') return send(200, { available, lifetimeHours: 24 });
      if (!available) throw new RoomError('Shared tables are not connected yet. The host needs to connect session storage.', 503);
      // Bearer credentials, never cookies. Requests from other origins cannot mutate rooms.
      if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}` && req.headers.origin !== `http://${req.headers.host}`) throw new RoomError('Please use the session website directly.', 403);
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      if (req.method === 'GET') {
        const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
        await store.limit(`read:${digest(ip).slice(0, 32)}`, 600, 60);
      }
      let input;
      if (req.method === 'POST') {
        input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!input || typeof input !== 'object' || JSON.stringify(input).length > 12000) throw new RoomError('Invalid session request.');
        const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
        await store.limit(digest(`${ip}:${input.action === 'create' ? 'create' : token}`).slice(0, 32), input.action === 'create' ? 10 : 90, 60);
        if (input.action === 'create') return send(201, await service.create(input));
      }
      return send(200, await service.access(url.searchParams.get('id'), token, input));
    } catch (error) {
      const status = error instanceof RoomError ? error.status : error instanceof SyntaxError ? 400 : 503;
      // Do not log phone numbers, access tokens, request bodies, or storage credentials.
      send(status, { error: error instanceof RoomError ? error.message : status === 400 ? 'Invalid session request.' : 'Unable to reach your table. Try again shortly.' });
    }
  };
}
