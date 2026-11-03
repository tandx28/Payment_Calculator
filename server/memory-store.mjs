// Explicit local preview/test store only. The production API never imports this file.
export function createMemoryStore(clock = Date.now) {
  const records = new Map();
  return {
    async create(id, value, expiresAt) { records.set(id, { value, expiresAt }); },
    async read(id) {
      const record = records.get(id);
      return record && record.expiresAt > clock() ? record.value : null;
    },
    async compareAndSet(id, before, after, expiresAt) {
      const record = records.get(id);
      if (!record || record.expiresAt <= clock() || record.value !== before) return false;
      records.set(id, { value: after, expiresAt });
      return true;
    },
    async limit() {},
  };
}
