import { RoomError } from './rooms.mjs';

// Counters are updated inside the same successful write, never on a failed CAS retry.
// pcall keeps optional analytics from preventing a result from being saved.
const METRICS = `for _, event in ipairs(cjson.decode(ARGV[4])) do redis.pcall('HINCRBY', KEYS[2], event, 1) end
if ARGV[4] ~= '[]' then redis.pcall('EXPIRE', KEYS[2], 7776000) end; return 1`;
const CAS = `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PXAT', ARGV[3]); ${METRICS}`;
const CREATE = `if not redis.call('SET', KEYS[1], ARGV[2], 'NX', 'PXAT', ARGV[3]) then return 0 end
${METRICS}`;
const LIMIT = `local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return count`;

export function redisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function createRedisStore(config = redisConfig()) {
  const metricKey = () => `settle:metrics:${process.env.VERCEL_ENV === 'production' ? 'production' : 'preview'}:${new Date().toISOString().slice(0, 10)}`;
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
    async create(id, value, expiresAt, metrics = []) {
      const result = metrics.length
        ? await command('EVAL', CREATE, 2, `settle:room:${id}`, metricKey(), '', value, expiresAt, JSON.stringify(metrics))
        : await command('SET', `settle:room:${id}`, value, 'NX', 'PXAT', expiresAt);
      if (result !== 'OK' && result !== 1) throw new RoomError('Could not create a session. Please retry.', 503);
    },
    compareAndSet: async (id, before, after, expiresAt, metrics = []) => (await command('EVAL', CAS, 2, `settle:room:${id}`, metricKey(), before, after, expiresAt, JSON.stringify(metrics))) === 1,
    async limit(key, max, seconds) {
      if ((await command('EVAL', LIMIT, 1, `settle:limit:${key}`, seconds)) > max) throw new RoomError('Too many requests. Give it a moment and try again.', 429);
    },
  };
}
