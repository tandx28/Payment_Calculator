export function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

// Older groups stored member names as strings. Preserve those groups on upgrade.
export function normalizeMember(member) {
  if (typeof member === 'string') return { name: member, mobile: '' };
  return {
    name: typeof member?.name === 'string' ? member.name : '',
    mobile: typeof member?.mobile === 'string' ? member.mobile : '',
  };
}
