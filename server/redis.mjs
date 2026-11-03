import { RoomError } from './rooms.mjs';

const CAS = `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PXAT', ARGV[3]); return 1`;
const LIMIT = `local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return count`;

export function redisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function createRedisStore(config = redisConfig()) {
  async function command(...args) {
    if (!config) throw new RoomError('Shared tables are not connected yet. The host needs to connect session storage.', 503);
    const response = await fetch(config.url, {
      method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
    });
    const json = await response.json();
    if (!response.ok || json.error) throw new RoomError('Session storage is temporarily unavailable. Your last saved result is unchanged.', 503);
    return json.result;
  }
  return {
    read: (id) => command('GET', `settle:room:${id}`),
    async create(id, value, expiresAt) {
      const result = await command('SET', `settle:room:${id}`, value, 'NX', 'PXAT', expiresAt);
      if (result !== 'OK') throw new RoomError('Could not create a session. Please retry.', 503);
    },
    compareAndSet: async (id, before, after, expiresAt) => (await command('EVAL', CAS, 1, `settle:room:${id}`, before, after, expiresAt)) === 1,
    async limit(key, max, seconds) {
      if ((await command('EVAL', LIMIT, 1, `settle:limit:${key}`, seconds)) > max) throw new RoomError('Too many requests. Give it a moment and try again.', 429);
    },
  };
}
