import { createHash, randomBytes } from 'node:crypto';
import { amountInCents, normalizeMobile } from '../src/process/paynow.mjs';
import { chipSettings, chipEntry, chipTally, settleChips } from '../src/process/chips.mjs';

export const ROOM_LIFETIME = 24 * 60 * 60 * 1000;
export class RoomError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const secret = () => randomBytes(24).toString('hex');
export const digest = (value) => createHash('sha256').update(String(value)).digest('hex');
const validToken = (value) => typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
const name = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40) throw new RoomError('Use a name between 1 and 40 characters.');
  return value.trim();
};
const mobile = (value) => {
  if (!value) return '';
  try { return normalizeMobile(value); } catch (error) { throw new RoomError(error.message); }
};

export function createRoom(input, now = Date.now()) {
  let settings;
  try { settings = chipSettings(input); } catch (error) { throw new RoomError(error.message); }
  const hostToken = secret();
  const inviteToken = secret();
  const hostId = randomBytes(12).toString('hex');
  return {
    hostToken, inviteToken,
    room: {
      id: randomBytes(16).toString('hex'), title: name(input.title || 'Tonight’s table'), settings,
      version: 1, round: 1, phase: 'lobby', createdAt: now, expiresAt: now + ROOM_LIFETIME,
      hostId, hostHash: digest(hostToken), inviteHash: digest(inviteToken),
      members: [{ id: hostId, name: name(input.name), mobile: mobile(input.mobile), tokenHash: digest(hostToken), cents: null, ready: false }],
    },
  };
}

export function authenticate(room, token) {
  if (!validToken(token)) throw new RoomError('Open your invite link or return on the browser you joined with.', 401);
  const hash = digest(token);
  if (hash === room.hostHash) return { host: true, id: room.hostId };
  const member = room.members.find((person) => person.tokenHash === hash);
  if (member) return { host: false, id: member.id };
  if (hash === room.inviteHash) return { invite: true };
  throw new RoomError('This session link or participant access is no longer valid.', 403);
}

function requireHost(actor) {
  if (!actor.host) throw new RoomError('Only the host can do that.', 403);
}

export function changeRoom(original, actor, input) {
  const room = structuredClone(original);
  if (input.action === 'join') {
    if (!actor.invite) throw new RoomError('Use the invitation to join.', 403);
    if (!validToken(input.playerToken)) throw new RoomError('Unable to create participant access. Reload and try again.');
    const tokenHash = digest(input.playerToken);
    if (tokenHash === room.inviteHash || tokenHash === room.hostHash) throw new RoomError('Use a separate participant credential.', 400);
    // A retried join returns the existing participant, even if the roster has since locked.
    if (room.members.some((person) => person.tokenHash === tokenHash)) return room;
    if (room.phase !== 'lobby') throw new RoomError('The host has locked this round. Ask them to reopen the table.', 409);
    if (room.members.length >= 20) throw new RoomError('This table is full (20 people).', 409);
    const playerName = name(input.name);
    if (room.members.some((person) => person.name.toLowerCase() === playerName.toLowerCase())) throw new RoomError('That name is taken. Add an initial so your friends know who’s who.');
    room.members.push({ id: randomBytes(12).toString('hex'), name: playerName, mobile: mobile(input.mobile), tokenHash, cents: null, ready: false });
  } else {
    if (actor.invite) throw new RoomError('Join the table first.', 403);
    if (!Number.isInteger(input.version) || input.version !== room.version) throw new RoomError('The table changed. Check the latest status and try again.', 409);
    switch (input.action) {
      case 'start':
        requireHost(actor);
        if (room.phase !== 'lobby' || room.members.length < 2) throw new RoomError('At least two people must join before the round starts.');
        room.phase = 'collecting';
        room.members.forEach((person) => { person.ready = false; });
        break;
      case 'submit':
      case 'update': {
        const chips = room.settings?.mode && room.settings.mode !== 'cash';
        if (chips && input.action !== 'submit') throw new RoomError('Use Save & ready to submit final chips.', 400);
        if (room.phase === 'settled') throw new RoomError('This round is locked. Ask the host to start a new round.', 409);
        if (input.action === 'submit' && room.phase !== 'collecting') throw new RoomError('Wait for the host to start the round.', 409);
        const person = room.members.find((member) => member.id === actor.id);
        if (input.action === 'submit' && person.ready) throw new RoomError('Edit your result before submitting again.', 409);
        try {
          if (chips) Object.assign(person, chipEntry(room.settings, input));
          else person.cents = amountInCents(input.value);
        } catch (error) { throw new RoomError(error.message); }
        person.mobile = mobile(input.mobile);
        if (input.action === 'submit' && (chips ? person.delta > 0 : person.cents > 0) && !person.mobile) throw new RoomError('You’re up! Add your PayNow mobile so your friends can scan to pay.');
        person.ready = input.action === 'submit';
        break;
      }
      case 'ready': {
        if (room.settings?.mode && room.settings.mode !== 'cash') throw new RoomError('Use Save & ready to submit final chips.');
        if (room.phase !== 'collecting') throw new RoomError('Wait for the host to start the round.', 409);
        const person = room.members.find((member) => member.id === actor.id);
        if (person.cents === null) throw new RoomError('Save your result before marking ready.');
        if (person.cents > 0 && !person.mobile) throw new RoomError('You’re up! Add your PayNow mobile so your friends can scan to pay.');
        person.ready = true;
        break;
      }
      case 'unready': {
        if (room.phase !== 'collecting') throw new RoomError('This round is locked.', 409);
        room.members.find((member) => member.id === actor.id).ready = false;
        break;
      }
      case 'remove':
        requireHost(actor);
        if (room.phase !== 'lobby' || input.memberId === room.hostId) throw new RoomError('Players can only be removed in the lobby.');
        room.members = room.members.filter((member) => member.id !== input.memberId);
        break;
      case 'reopen':
      case 'new-round':
        requireHost(actor);
        if (input.action === 'new-round') {
          if (room.phase !== 'settled') throw new RoomError('Finish this round first.');
          room.round += 1;
          room.members.forEach((person) => { person.cents = null; delete person.finalChips; delete person.buyIns; delete person.delta; });
          delete room.chipRounding;
        } else if (room.phase === 'settled') throw new RoomError('Start a new round to change a settled table.');
        room.phase = 'lobby';
        room.members.forEach((person) => { person.ready = false; });
        break;
      default: throw new RoomError('Unknown session action.');
    }
  }
  const everyoneReady = room.members.length >= 2 && room.members.every((person) => person.ready && person.cents !== null);
  const total = room.members.reduce((sum, person) => sum + (person.cents || 0), 0);
  if (room.phase === 'collecting' && everyoneReady) {
    if (room.settings?.mode && room.settings.mode !== 'cash') {
      if (chipTally(room.settings, room.members).difference === 0) {
        let result;
        try { result = settleChips(room.settings, room.members); } catch (error) { throw new RoomError(error.message); }
        room.members.forEach((person, index) => { person.cents = result.cents[index]; });
        room.chipRounding = result.fractionalCents;
        room.phase = 'settled';
      }
    } else if (total === 0) room.phase = 'settled';
  }
  room.version += 1;
  return room;
}

export function publicRoom(room, actor) {
  const base = { id: room.id, title: room.title, round: room.round, phase: room.phase, version: room.version, expiresAt: room.expiresAt, memberCount: room.members.length, settings: room.settings || { mode: 'cash' }, chipRounding: Boolean(room.chipRounding) };
  if (actor.invite) return { ...base, needsJoin: true };
  const members = room.members.map((person) => ({
    id: person.id, name: person.name, cents: person.cents, ready: person.ready, host: person.id === room.hostId,
    ...(room.settings?.mode && room.settings.mode !== 'cash' ? { finalChips: person.finalChips ?? null, buyIns: person.buyIns ?? 1 } : {}),
    mobile: room.phase === 'settled' || actor.id === person.id ? person.mobile : '',
  }));
  return { ...base, members, me: actor.id, isHost: Boolean(actor.host) };
}

export function createRoomService(store, clock = Date.now) {
  return {
    async create(input) {
      const created = createRoom(input, clock());
      await store.create(created.room.id, JSON.stringify(created.room), created.room.expiresAt, input.analytics === true ? ['tables_created'] : []);
      return { ...publicRoom(created.room, { id: created.room.hostId, host: true }), token: created.hostToken, inviteToken: created.inviteToken };
    },
    async access(id, token, input) {
      if (!/^[a-f0-9]{32}$/.test(id || '')) throw new RoomError('Session not found.', 404);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const raw = await store.read(id);
        if (!raw) throw new RoomError('This session has expired or does not exist. Ask the host for a new link.', 404);
        const room = JSON.parse(raw);
        if (room.expiresAt <= clock()) throw new RoomError('This session has expired. Create a new table.', 410);
        const actor = authenticate(room, token);
        if (!input) return publicRoom(room, actor);
        const updated = changeRoom(room, actor, input);
        const metrics = [];
        if (input.analytics === true) {
          if (updated.members.length > room.members.length) metrics.push('players_joined');
          if (input.action === 'start') metrics.push('rounds_started');
          if (input.action === 'submit') metrics.push('results_submitted');
          if (room.phase !== 'settled' && updated.phase === 'settled') metrics.push('payment_plans_unlocked');
        }
        if (await store.compareAndSet(id, raw, JSON.stringify(updated), room.expiresAt, metrics)) {
          const viewer = input.action === 'join' ? authenticate(updated, input.playerToken) : actor;
          return publicRoom(updated, viewer);
        }
        // Joining may safely retry. Updates with stale versions fail rather than overwrite another result.
      }
      throw new RoomError('The table is busy. Please try again.', 409);
    },
  };
}
