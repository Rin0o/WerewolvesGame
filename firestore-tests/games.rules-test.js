import fs from 'fs';
import path from 'path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy,
  serverTimestamp, arrayRemove, setLogLevel,
} from 'firebase/firestore';

const STARTED = 1763100000000;
const ROOM = 'game-room';
const GAME_ID = `${ROOM}_${STARTED}`;

let env;

function dbAs(uid) {
  return uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
}

function endedRoom(overrides = {}) {
  return {
    code: 'ABCDE',
    hostId: 'alice',
    memberIds: ['alice', 'bob', 'carol'],
    status: 'ended',
    winner: 'villagers',
    gameStartedAt: STARTED,
    players: [],
    ...overrides,
  };
}

function record(overrides = {}) {
  return {
    roomId: ROOM,
    code: 'ABCDE',
    gameStartedAt: STARTED,
    endedAt: serverTimestamp(),
    gameMode: 'normal',
    classicFirstNight: false,
    tieRule: 'no_lynch',
    rounds: 3,
    winner: 'villagers',
    roleComposition: { werewolf: 1, villager: 2 },
    withBots: true,
    narratorId: null,
    playerIds: ['alice', 'bob'],
    winnerIds: ['alice'],
    players: [
      { id: 'alice', nickname: 'Alice', role: 'villager', infected: false, won: true, alive: true, isBot: false, isNarrator: false },
      { id: 'bob', nickname: 'Bob', role: 'werewolf', infected: false, won: false, alive: false, isBot: false, isNarrator: false },
      { id: 'bot-0', nickname: 'Tom 🤖', role: 'villager', infected: false, won: true, alive: true, isBot: true, isNarrator: false },
    ],
    events: ['Game started with 3 players.', 'Night 2: Bob was found dead.'],
    history: [{ time: 'night', round: 2, act: 'wolf_vote', by: 'bob', target: 'alice' }],
    ...overrides,
  };
}

async function seed({ room = endedRoom(), game = null } = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'rooms', ROOM), room);
    if (game) await setDoc(doc(db, 'games', GAME_ID), { ...game, endedAt: new Date() });
  });
}

function gameAs(uid, id = GAME_ID) {
  return doc(dbAs(uid), 'games', id);
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

describe('saving a finished game', () => {
  test('the host saves it once the room has ended', async () => {
    await seed();
    await assertSucceeds(setDoc(gameAs('alice'), record()));
  });

  test('nobody but the host saves it', async () => {
    await seed();
    await assertFails(setDoc(gameAs('bob'), record()));
    await assertFails(setDoc(gameAs(null), record()));
  });

  test('only once the game is over, with its real winner and start', async () => {
    await seed({ room: endedRoom({ status: 'day', winner: null }) });
    await assertFails(setDoc(gameAs('alice'), record()));
    await seed();
    await assertFails(setDoc(gameAs('alice'), record({ winner: 'werewolves' })));
    await assertFails(setDoc(gameAs('alice'), record({ gameStartedAt: STARTED + 1 })));
    await assertFails(setDoc(gameAs('alice', `${ROOM}_${STARTED + 1}`), record()));
  });

  test('players must be members of the room, and winners must be players', async () => {
    await seed();
    await assertFails(setDoc(gameAs('alice'), record({ playerIds: ['alice', 'mallory'] })));
    await assertFails(setDoc(gameAs('alice'), record({ winnerIds: ['carol'] })));
    await assertFails(setDoc(gameAs('alice'), record({ narratorId: 'carol' })));
  });

  test('the end time is the server time and no extra fields are stored', async () => {
    await seed();
    await assertFails(setDoc(gameAs('alice'), record({ endedAt: new Date(0) })));
    await assertFails(setDoc(gameAs('alice'), record({ email: 'alice@example.com' })));
  });

  test('a saved game is never overwritten or deleted', async () => {
    await seed({ game: record() });
    await assertFails(setDoc(gameAs('alice'), record()));
    await assertFails(deleteDoc(gameAs('alice')));
  });
});

describe('reading the history', () => {
  test('players of the game read it, others do not', async () => {
    await seed({ game: record() });
    await assertSucceeds(getDoc(gameAs('alice')));
    await assertSucceeds(getDoc(gameAs('bob')));
    await assertFails(getDoc(gameAs('carol')));
    await assertFails(getDoc(gameAs(null)));
  });

  test('a player lists their own games, newest first', async () => {
    await seed({ game: record() });
    const games = collection(dbAs('bob'), 'games');
    await assertSucceeds(getDocs(query(games, where('playerIds', 'array-contains', 'bob'), orderBy('endedAt', 'desc'))));
    await assertSucceeds(getDocs(query(games, where('winnerIds', 'array-contains', 'bob'))));
    await assertSucceeds(getDocs(query(games, where('narratorId', '==', 'bob'))));
    await assertFails(getDocs(query(games, where('playerIds', 'array-contains', 'alice'))));
    await assertFails(getDocs(games));
  });
});

describe('leaving the history when deleting an account', () => {
  test('a player removes only themselves', async () => {
    await seed({ game: record() });
    await assertSucceeds(updateDoc(gameAs('alice'), { playerIds: arrayRemove('alice'), winnerIds: arrayRemove('alice') }));
  });

  test('a narrator also clears the narrator field', async () => {
    await seed({ game: record({ narratorId: 'bob' }) });
    await assertSucceeds(updateDoc(gameAs('bob'), { playerIds: arrayRemove('bob'), winnerIds: arrayRemove('bob'), narratorId: null }));
  });

  test('nobody removes someone else or changes anything else', async () => {
    await seed({ game: record() });
    await assertFails(updateDoc(gameAs('bob'), { playerIds: arrayRemove('alice') }));
    await assertFails(updateDoc(gameAs('bob'), { playerIds: arrayRemove('bob'), winner: 'werewolves' }));
    await assertFails(updateDoc(gameAs('carol'), { playerIds: arrayRemove('carol') }));
  });
});
