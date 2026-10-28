import fs from 'fs';
import path from 'path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  collection,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  setLogLevel,
} from 'firebase/firestore';

const ROOM = 'room-1';
let env;

function player(id, extra = {}) {
  return { id, nickname: id, isAlive: true, isHost: id === 'host', isReady: false, ...extra };
}

const LOBBY = {
  code: 'ABCDE',
  hostId: 'host',
  status: 'lobby',
  phase: 0,
  memberIds: ['host', 'alice', 'bob'],
  players: [player('host'), player('alice'), player('bob')],
  roles: {},
  nightActions: {},
  votes: {},
  events: [],
  winner: null,
};

const NIGHT = {
  ...LOBBY,
  status: 'night',
  phase: 2,
  memberIds: ['host', 'alice', 'bob', 'sam', 'wendy'],
  players: ['host', 'alice', 'bob', 'sam', 'wendy'].map((id) => player(id, { isReady: true })),
  roles: { host: 'villager', alice: 'werewolf', bob: 'hunter', sam: 'seer', wendy: 'witch' },
  disconnectedPlayers: [],
};

const DAY = { ...NIGHT, status: 'day' };

async function seed(room, chats = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'rooms', ROOM), room);
    for (const [chat, messages] of Object.entries(chats)) {
      for (const [id, message] of Object.entries(messages)) {
        await setDoc(doc(db, 'rooms', ROOM, chat, id), message);
      }
    }
  });
}

function as(uid) {
  const db = uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
  return { db, room: doc(db, 'rooms', ROOM) };
}

function message(senderId, text = 'hello') {
  return { senderId, senderNickname: senderId, text, createdAt: serverTimestamp() };
}

beforeAll(async () => {
  setLogLevel('error');
  env = await initializeTestEnvironment({
    projectId: 'demo-werewolves',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

describe('creating and reading rooms', () => {
  const newRoom = (uid, overrides = {}) => ({
    code: 'XYZ12', hostId: uid, status: 'lobby', phase: 0, memberIds: [uid],
    players: [player(uid, { isHost: true })], roles: {}, nightActions: {}, votes: {}, events: [], winner: null,
    createdAt: serverTimestamp(), ...overrides,
  });

  it('a signed-in player creates their own room', async () => {
    const { db } = as('carol');
    await assertSucceeds(setDoc(doc(db, 'rooms', 'new'), newRoom('carol')));
  });

  it('nobody creates a room for someone else, or without the member list', async () => {
    const { db } = as('carol');
    await assertFails(setDoc(doc(db, 'rooms', 'new'), newRoom('carol', { hostId: 'dave' })));
    await assertFails(setDoc(doc(db, 'rooms', 'new'), newRoom('carol', { memberIds: [] })));
    await assertFails(setDoc(doc(db, 'rooms', 'new'), newRoom('carol', { status: 'night' })));
  });

  it('signed-out users can do nothing', async () => {
    await seed(LOBBY);
    const { db, room } = as(null);
    await assertFails(getDoc(room));
    await assertFails(setDoc(doc(db, 'rooms', 'new'), newRoom('x')));
  });

  it('any signed-in player can read a room (needed to find it by code)', async () => {
    await seed(LOBBY);
    await assertSucceeds(getDoc(as('stranger').room));
  });

  it('nobody deletes a room', async () => {
    await seed(LOBBY);
    await assertFails(deleteDoc(as('host').room));
  });
});

describe('lobby', () => {
  beforeEach(() => seed(LOBBY));

  it('a new player joins the way the app does', async () => {
    const { room } = as('carol');
    await assertSucceeds(updateDoc(room, { players: arrayUnion(player('carol')), memberIds: arrayUnion('carol') }));
  });

  it('nobody joins as someone else or as host', async () => {
    const { room } = as('carol');
    await assertFails(updateDoc(room, { players: arrayUnion(player('dave')), memberIds: arrayUnion('carol') }));
    await assertFails(updateDoc(room, { players: arrayUnion(player('carol', { isHost: true })), memberIds: arrayUnion('carol') }));
  });

  it('nobody joins without being added to the member list', async () => {
    await assertFails(updateDoc(as('carol').room, { players: arrayUnion(player('carol')) }));
  });

  it('nobody joins a game that has started', async () => {
    await seed(NIGHT);
    const { room } = as('carol');
    await assertFails(updateDoc(room, { players: arrayUnion(player('carol')), memberIds: arrayUnion('carol') }));
  });

  it('a player leaves the lobby the way the app does', async () => {
    const { room } = as('alice');
    await assertSucceeds(updateDoc(room, {
      players: LOBBY.players.filter((p) => p.id !== 'alice'),
      memberIds: arrayRemove('alice'),
    }));
  });

  it('a player cannot remove someone else', async () => {
    const { room } = as('alice');
    await assertFails(updateDoc(room, {
      players: LOBBY.players.filter((p) => p.id !== 'bob'),
      memberIds: arrayRemove('alice'),
    }));
  });

  it('a player toggles their own ready flag but nobody else\'s', async () => {
    const { room } = as('alice');
    const readyFor = (id) => LOBBY.players.map((p) => (p.id === id ? { ...p, isReady: true } : p));
    await assertSucceeds(updateDoc(room, { players: readyFor('alice') }));
    await assertFails(updateDoc(room, { players: readyFor('bob') }));
  });

  it('a player cannot change anything else about themselves', async () => {
    const players = LOBBY.players.map((p) => (p.id === 'alice' ? { ...p, isHost: true } : p));
    await assertFails(updateDoc(as('alice').room, { players }));
  });

  it('only the host changes game settings and starts the game', async () => {
    await assertSucceeds(updateDoc(as('host').room, { gameMode: 'custom' }));
    await assertFails(updateDoc(as('alice').room, { gameMode: 'normal' }));
    await assertFails(updateDoc(as('alice').room, { status: 'night', roles: { alice: 'seer' } }));
    await assertSucceeds(updateDoc(as('host').room, { status: 'night', roles: { host: 'villager', alice: 'werewolf', bob: 'seer' } }));
  });

  it('the host cannot edit the member list or the room code', async () => {
    await assertFails(updateDoc(as('host').room, { memberIds: arrayUnion('mallory') }));
    await assertFails(updateDoc(as('host').room, { code: 'ZZZZZ' }));
  });

  it('strangers cannot change a room', async () => {
    await assertFails(updateDoc(as('stranger').room, { gameMode: 'custom' }));
  });
});

describe('night actions', () => {
  beforeEach(() => seed(NIGHT));

  it('each role writes only its own action', async () => {
    await assertSucceeds(updateDoc(as('alice').room, { 'nightActions.wolfVotes.alice': 'sam' }));
    await assertSucceeds(updateDoc(as('sam').room, { 'nightActions.seer': 'alice' }));
    await assertSucceeds(updateDoc(as('wendy').room, { 'nightActions.witchSkip': true }));
  });

  it('a role cannot write another role\'s action', async () => {
    await assertFails(updateDoc(as('sam').room, { 'nightActions.wolfVotes.sam': 'wendy' }));
    await assertFails(updateDoc(as('alice').room, { 'nightActions.witchPoison': 'sam' }));
    await assertFails(updateDoc(as('bob').room, { 'nightActions.seer': 'alice' }));
  });

  it('a wolf casts only their own vote, and only the host settles the victim', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, bob: 'werewolf' } });
    await assertSucceeds(updateDoc(as('alice').room, { 'nightActions.wolfVotes.alice': 'sam' }));
    await assertSucceeds(updateDoc(as('alice').room, { 'nightActions.wolfVotes.alice': 'wendy' }));
    await assertFails(updateDoc(as('alice').room, { 'nightActions.wolfVotes.bob': 'sam' }));
    await assertFails(updateDoc(as('alice').room, { 'nightActions.werewolf': 'sam' }));
    await assertSucceeds(updateDoc(as('host').room, { 'nightActions.werewolf': 'wendy' }));
  });

  it('the White Wolf hunts with the pack and devours alone; the Wolf Hound picks a side', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, bob: 'white_wolf', sam: 'wolf_hound' } });
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.wolfVotes.bob': 'wendy' }));
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.whiteWolf': 'alice' }));
    await assertSucceeds(updateDoc(as('sam').room, { 'nightActions.wolfHound': 'werewolf' }));
    await assertFails(updateDoc(as('alice').room, { 'nightActions.whiteWolf': 'bob' }));
    await assertFails(updateDoc(as('sam').room, { 'nightActions.wolfVotes.sam': 'host' }));
  });

  it('the Fox sniffs or stays hidden, and cannot take away its own power', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, bob: 'fox' } });
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.fox': 'alice' }));
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.foxSkip': true }));
    await assertFails(updateDoc(as('bob').room, { foxPowerLost: false }));
    await assertFails(updateDoc(as('sam').room, { 'nightActions.fox': 'wendy' }));
    await assertSucceeds(updateDoc(as('host').room, { foxPowerLost: true }));
  });

  it('the Wild Child picks its role model, and nobody else can', async () => {
    await seed({ ...NIGHT, phase: 1, roles: { ...NIGHT.roles, bob: 'wild_child' } });
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.wildChild': 'sam' }));
    await assertFails(updateDoc(as('sam').room, { 'nightActions.wildChild': 'wendy' }));
    await assertFails(updateDoc(as('bob').room, { wildChildModel: 'wendy' }));
  });

  it('the Big Bad Wolf votes with the pack and hunts alone; nobody else can', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, bob: 'big_bad_wolf' } });
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.wolfVotes.bob': 'sam' }));
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.bigBadWolf': 'wendy' }));
    await assertFails(updateDoc(as('alice').room, { 'nightActions.bigBadWolf': 'sam' }));
    await assertFails(updateDoc(as('bob').room, { 'nightActions.wolfVotes.alice': 'host' }));
  });

  it('the Raven marks or passes, and only the host publishes the mark', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, bob: 'raven' } });
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.raven': 'alice' }));
    await assertSucceeds(updateDoc(as('bob').room, { 'nightActions.ravenSkip': true }));
    await assertFails(updateDoc(as('sam').room, { 'nightActions.raven': 'wendy' }));
    await assertFails(updateDoc(as('bob').room, { ravenMark: 'wendy' }));
    await assertSucceeds(updateDoc(as('host').room, { ravenMark: 'alice' }));
  });

  it('nobody but the host advances the night', async () => {
    await assertFails(updateDoc(as('alice').room, { nightSubPhase: 'seer' }));
    await assertSucceeds(updateDoc(as('host').room, { nightSubPhase: 'seer', 'nightActions.werewolf': 'sam' }));
  });

  it('a player marks only themselves as having read their role', async () => {
    await assertSucceeds(updateDoc(as('alice').room, { roleAcknowledged: arrayUnion('alice') }));
    await assertSucceeds(updateDoc(as('sam').room, { roleAcknowledged: arrayUnion('sam') }));
    await assertFails(updateDoc(as('alice').room, { roleAcknowledged: arrayUnion('bob') }));
  });

  it('night actions are refused during the day', async () => {
    await seed(DAY);
    await assertFails(updateDoc(as('alice').room, { 'nightActions.wolfVotes.alice': 'sam' }));
  });
});

describe('day', () => {
  beforeEach(() => seed(DAY));

  it('a player casts their own vote, not someone else\'s', async () => {
    await assertSucceeds(updateDoc(as('alice').room, { 'votes.alice': { target: 'sam', confirmed: true } }));
    await assertFails(updateDoc(as('alice').room, { 'votes.bob': { target: 'sam', confirmed: true } }));
  });

  it('only the host closes voting and resolves the day', async () => {
    await assertFails(updateDoc(as('alice').room, { votesClosed: true }));
    await assertSucceeds(updateDoc(as('host').room, { votesClosed: true }));
  });

  it('the Hunter fires their shot, and nobody else can', async () => {
    await seed({ ...DAY, hunterTriggered: 'bob' });
    const shot = {
      players: DAY.players.map((p) => (p.id === 'alice' ? { ...p, isAlive: false } : p)),
      winner: 'villagers',
      status: 'ended',
      hunterTriggered: null,
      events: arrayUnion('The Hunter\'s last shot took down alice.'),
    };
    await assertFails(updateDoc(as('sam').room, shot));
    await assertSucceeds(updateDoc(as('bob').room, shot));
  });

  it('a revealed Village Idiot can no longer vote', async () => {
    await seed({ ...DAY, roles: { ...DAY.roles, sam: 'village_idiot' }, idiotRevealed: 'sam' });
    await assertFails(updateDoc(as('sam').room, { 'votes.sam': { target: 'alice', confirmed: true } }));
    await assertSucceeds(updateDoc(as('wendy').room, { 'votes.wendy': { target: 'sam', confirmed: true } }));
  });

  it('the Hunter\'s shot may turn the Wild Child into a werewolf, and change no other role', async () => {
    const roles = { ...DAY.roles, wendy: 'wild_child' };
    await seed({ ...DAY, roles, hunterTriggered: 'bob', wildChildId: 'wendy', wildChildModel: 'sam' });
    const shot = (newRoles) => ({
      players: DAY.players.map((p) => (p.id === 'sam' ? { ...p, isAlive: false } : p)),
      winner: null,
      hunterTriggered: null,
      events: arrayUnion('The Hunter\'s last shot took down sam.'),
      roles: newRoles,
      wildChildTurnedAt: '2026-10-28T20:00:00.000Z',
    });
    await assertFails(updateDoc(as('bob').room, shot({ ...roles, bob: 'werewolf' })));
    await assertFails(updateDoc(as('bob').room, shot({ ...roles, wendy: 'seer' })));
    await assertFails(updateDoc(as('bob').room, shot({ ...roles, wendy: 'werewolf', host: 'werewolf' })));
    await assertSucceeds(updateDoc(as('bob').room, shot({ ...roles, wendy: 'werewolf' })));
  });

  it('without a Wild Child, the Hunter cannot touch the roles', async () => {
    await seed({ ...DAY, hunterTriggered: 'bob' });
    await assertFails(updateDoc(as('bob').room, { hunterTriggered: null, roles: { ...DAY.roles, bob: 'werewolf' } }));
  });
});

describe('leaving and host takeover', () => {
  beforeEach(() => seed(NIGHT));

  it('a player marks only themselves as gone or back', async () => {
    await assertSucceeds(updateDoc(as('alice').room, { disconnectedPlayers: arrayUnion('alice') }));
    await assertSucceeds(updateDoc(as('alice').room, { disconnectedPlayers: arrayRemove('alice') }));
    await assertFails(updateDoc(as('alice').room, { disconnectedPlayers: arrayUnion('bob') }));
  });

  it('only the host sends heartbeats', async () => {
    await assertSucceeds(updateDoc(as('host').room, { hostHeartbeat: increment(1) }));
    await assertFails(updateDoc(as('alice').room, { hostHeartbeat: increment(1) }));
  });

  it('a player can take over as host, but only for themselves', async () => {
    const takeover = (newHost) => ({
      hostId: newHost,
      hostHeartbeat: 1,
      players: NIGHT.players.map((p) => ({ ...p, isHost: p.id === newHost })),
    });
    await assertFails(updateDoc(as('alice').room, takeover('bob')));
    await assertFails(updateDoc(as('stranger').room, takeover('stranger')));
    await assertSucceeds(updateDoc(as('alice').room, takeover('alice')));
  });
});

describe('chats', () => {
  const dayChat = (db) => collection(db, 'rooms', ROOM, 'dayChat');
  const wolfChat = (db) => collection(db, 'rooms', ROOM, 'werewolfChat');

  beforeEach(() => seed(NIGHT, { dayChat: { m1: { senderId: 'sam', senderNickname: 'sam', text: 'hi', createdAt: new Date() } } }));

  it('members read and post in the day chat, strangers cannot', async () => {
    await assertSucceeds(getDocs(dayChat(as('alice').db)));
    await assertSucceeds(addDoc(dayChat(as('alice').db), message('alice')));
    await assertFails(getDocs(dayChat(as('stranger').db)));
    await assertFails(addDoc(dayChat(as('stranger').db), message('stranger')));
  });

  it('messages must come from the sender and stay under 500 characters', async () => {
    await assertFails(addDoc(dayChat(as('alice').db), message('bob')));
    await assertFails(addDoc(dayChat(as('alice').db), message('alice', 'x'.repeat(501))));
    await assertFails(addDoc(dayChat(as('alice').db), message('alice', '')));
  });

  it('only werewolves post in the wolf chat', async () => {
    await assertSucceeds(addDoc(wolfChat(as('alice').db), message('alice')));
    await assertFails(addDoc(wolfChat(as('sam').db), message('sam')));
  });

  it('the White Wolf and the Big Bad Wolf post in the wolf chat too', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, bob: 'white_wolf', sam: 'big_bad_wolf' } });
    await assertSucceeds(addDoc(wolfChat(as('bob').db), message('bob')));
    await assertSucceeds(addDoc(wolfChat(as('sam').db), message('sam')));
  });

  it('the host posts for the bots in the day chat, nobody else does', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, 'bot-0': 'villager' } });
    await assertSucceeds(addDoc(dayChat(as('host').db), message('bot-0')));
    await assertFails(addDoc(dayChat(as('alice').db), message('bot-0')));
    await assertFails(addDoc(dayChat(as('host').db), message('bot-9')));
    await assertFails(addDoc(dayChat(as('host').db), message('bot-0', 'x'.repeat(501))));
  });

  it('only wolf bots post in the wolf chat, through the host', async () => {
    await seed({ ...NIGHT, roles: { ...NIGHT.roles, 'bot-0': 'werewolf', 'bot-1': 'villager' } });
    await assertSucceeds(addDoc(wolfChat(as('host').db), message('bot-0')));
    await assertFails(addDoc(wolfChat(as('host').db), message('bot-1')));
    await assertFails(addDoc(wolfChat(as('alice').db), message('bot-0')));
  });

  it('only the host clears chats', async () => {
    await assertFails(deleteDoc(doc(as('alice').db, 'rooms', ROOM, 'dayChat', 'm1')));
    await assertSucceeds(deleteDoc(doc(as('host').db, 'rooms', ROOM, 'dayChat', 'm1')));
  });
});

describe('sisters chat', () => {
  const sisterChat = (db) => collection(db, 'rooms', ROOM, 'sisterChat');
  const SISTERS_NIGHT = { ...NIGHT, roles: { ...NIGHT.roles, bob: 'sister', sam: 'sister' } };

  beforeEach(() => seed(SISTERS_NIGHT, { sisterChat: { m1: { senderId: 'bob', senderNickname: 'bob', text: 'hi', createdAt: new Date() } } }));

  it('only sisters post, and only at night', async () => {
    await assertSucceeds(addDoc(sisterChat(as('bob').db), message('bob')));
    await assertFails(addDoc(sisterChat(as('alice').db), message('alice')));
    await assertFails(addDoc(sisterChat(as('bob').db), message('sam')));
    await seed({ ...SISTERS_NIGHT, status: 'day' });
    await assertFails(addDoc(sisterChat(as('bob').db), message('bob')));
  });

  it('members read it, strangers cannot', async () => {
    await assertSucceeds(getDocs(sisterChat(as('host').db)));
    await assertFails(getDocs(sisterChat(as('stranger').db)));
  });

  it('only sister bots post, through the host', async () => {
    await seed({ ...SISTERS_NIGHT, roles: { ...SISTERS_NIGHT.roles, 'bot-0': 'sister', 'bot-1': 'villager' } });
    await assertSucceeds(addDoc(sisterChat(as('host').db), message('bot-0')));
    await assertFails(addDoc(sisterChat(as('host').db), message('bot-1')));
    await assertFails(addDoc(sisterChat(as('bob').db), message('bot-0')));
  });

  it('only the host clears it', async () => {
    await assertFails(deleteDoc(doc(as('bob').db, 'rooms', ROOM, 'sisterChat', 'm1')));
    await assertSucceeds(deleteDoc(doc(as('host').db, 'rooms', ROOM, 'sisterChat', 'm1')));
  });
});
