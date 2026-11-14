jest.mock('../config', () => ({ db: 'db' }));
jest.mock('firebase/firestore', () => {
  const batches = [];
  return {
    batches,
    collection: jest.fn((db, name) => `collection:${name}`),
    doc: jest.fn((db, name, id) => `${name}/${id}`),
    setDoc: jest.fn(() => Promise.resolve()),
    getDocs: jest.fn(),
    query: jest.fn((source, ...constraints) => ({ source, constraints })),
    where: jest.fn((...args) => ['where', ...args]),
    orderBy: jest.fn((...args) => ['orderBy', ...args]),
    limit: jest.fn((n) => ['limit', n]),
    startAfter: jest.fn((cursor) => ['startAfter', cursor]),
    getCountFromServer: jest.fn(),
    serverTimestamp: jest.fn(() => 'server-time'),
    arrayRemove: jest.fn((value) => ({ arrayRemove: value })),
    writeBatch: jest.fn(() => {
      const batch = { updates: [], update: jest.fn((ref, data) => batch.updates.push({ ref, data })), commit: jest.fn(() => Promise.resolve()) };
      batches.push(batch);
      return batch;
    }),
  };
});

import { setDoc, getDocs, query, getCountFromServer, batches } from 'firebase/firestore';
import { saveMatchRecord, loadMyGames, countMyGames, forgetMyGames, GAMES_PAGE_SIZE } from '../historyService';

function gameDocs(count, data = () => ({})) {
  return Array.from({ length: count }, (_, i) => ({ id: `g${i}`, ref: `games/g${i}`, data: () => data(i) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  batches.length = 0;
});

describe('saveMatchRecord', () => {
  it('stamps the end time on the server', async () => {
    await saveMatchRecord('room_1', { winner: 'villagers' });
    expect(setDoc).toHaveBeenCalledWith('games/room_1', { winner: 'villagers', endedAt: 'server-time' });
  });
});

describe('loadMyGames', () => {
  it('asks for the player\'s games, newest first, one page at a time', async () => {
    getDocs.mockResolvedValue({ docs: gameDocs(2, (i) => ({ winner: 'villagers', round: i })) });
    const page = await loadMyGames('me');
    expect(query.mock.calls[0][1]).toEqual(['where', 'playerIds', 'array-contains', 'me']);
    expect(query.mock.calls[0].slice(2)).toEqual([['orderBy', 'endedAt', 'desc'], ['limit', GAMES_PAGE_SIZE]]);
    expect(page.games).toEqual([{ id: 'g0', winner: 'villagers', round: 0 }, { id: 'g1', winner: 'villagers', round: 1 }]);
    expect(page.last.id).toBe('g1');
    expect(page.hasMore).toBe(false);
  });

  it('continues after the last game of the previous page', async () => {
    getDocs.mockResolvedValue({ docs: gameDocs(GAMES_PAGE_SIZE) });
    const page = await loadMyGames('me', 'cursor');
    expect(query.mock.calls[0]).toContainEqual(['startAfter', 'cursor']);
    expect(page.hasMore).toBe(true);
  });

  it('has no cursor when there are no games', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await expect(loadMyGames('me')).resolves.toEqual({ games: [], last: null, hasMore: false });
  });
});

describe('countMyGames', () => {
  it('counts games played, won and narrated', async () => {
    getCountFromServer
      .mockResolvedValueOnce({ data: () => ({ count: 12 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 5 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 2 }) });
    await expect(countMyGames('me')).resolves.toEqual({ played: 12, won: 5, narrated: 2 });
    expect(query.mock.calls.map((call) => call[1])).toEqual([
      ['where', 'playerIds', 'array-contains', 'me'],
      ['where', 'winnerIds', 'array-contains', 'me'],
      ['where', 'narratorId', '==', 'me'],
    ]);
  });
});

describe('forgetMyGames', () => {
  it('removes the player from every game and clears the narrator only where they narrated', async () => {
    getDocs.mockResolvedValue({ docs: gameDocs(2, (i) => ({ narratorId: i === 1 ? 'me' : 'someone' })) });
    await forgetMyGames('me');
    expect(batches).toHaveLength(1);
    expect(batches[0].updates).toEqual([
      { ref: 'games/g0', data: { playerIds: { arrayRemove: 'me' }, winnerIds: { arrayRemove: 'me' } } },
      { ref: 'games/g1', data: { playerIds: { arrayRemove: 'me' }, winnerIds: { arrayRemove: 'me' }, narratorId: null } },
    ]);
    expect(batches[0].commit).toHaveBeenCalled();
  });

  it('splits a long history into several writes', async () => {
    getDocs.mockResolvedValue({ docs: gameDocs(450) });
    await forgetMyGames('me');
    expect(batches.map((b) => b.updates.length)).toEqual([400, 50]);
    batches.forEach((b) => expect(b.commit).toHaveBeenCalled());
  });

  it('writes nothing without games', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await forgetMyGames('me');
    expect(batches).toHaveLength(0);
  });
});
