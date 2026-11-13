jest.mock('../../firebase/roomService', () => ({
  updateRoom: jest.fn(() => Promise.resolve()),
  eliminatePlayer: jest.fn(() => Promise.resolve()),
  getRoom: jest.fn(),
  clearNightActions: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import { nightActs, dayVoteActs } from '../history';
import { resolveNight, resolveLynch, startRevote, advanceNightUpdate } from '../gameManager';
import { updateRoom } from '../../firebase/roomService';
import { makeGame, votesFor, lastUpdate, ROOM_ID } from './helpers';

const TABLE = {
  will: 'werewolf',
  wren: 'werewolf',
  sam: 'seer',
  wendy: 'witch',
  sav: 'saviour',
  fox: 'fox',
  rae: 'raven',
  vic: 'villager',
  vera: 'villager',
};

beforeEach(() => jest.clearAllMocks());

const acts = (list, act) => list.filter((a) => a.act === act);

describe('nightActs', () => {
  it('records every hidden action of the night with who did it', () => {
    const room = makeGame(TABLE, {
      phase: 3,
      nightActions: {
        wolfVotes: { will: 'vic', wren: 'vic' }, werewolf: 'vic',
        saviour: 'sam', witchPoison: 'wren', seer: 'will', fox: 'rae', raven: 'vera',
      },
    });
    const list = nightActs(room, room.roles);
    expect(list.every((a) => a.time === 'night' && a.round === 3)).toBe(true);
    expect(acts(list, 'wolf_vote').map((a) => [a.by, a.target])).toEqual([['will', 'vic'], ['wren', 'vic']]);
    expect(acts(list, 'pack')).toEqual([expect.objectContaining({ target: 'vic' })]);
    expect(acts(list, 'saviour')).toEqual([expect.objectContaining({ by: 'sav', target: 'sam' })]);
    expect(acts(list, 'witch_poison')).toEqual([expect.objectContaining({ by: 'wendy', target: 'wren' })]);
    expect(acts(list, 'seer')).toEqual([expect.objectContaining({ by: 'sam', target: 'will', wolf: true })]);
    expect(acts(list, 'fox')).toEqual([expect.objectContaining({ by: 'fox', targets: ['fox', 'rae', 'vic'], wolf: false })]);
    expect(acts(list, 'raven')).toEqual([expect.objectContaining({ by: 'rae', target: 'vera' })]);
  });

  it('records a split pack and a quiet night with nothing in it', () => {
    expect(acts(nightActs(makeGame(TABLE, { nightActions: { wolfNoKill: true } }), TABLE), 'pack_split')).toHaveLength(1);
    expect(nightActs(makeGame(TABLE, { phase: 1, nightActions: { werewolfObserved: true } }), TABLE)).toEqual([]);
  });

  it('never writes undefined, which Firestore refuses', () => {
    const list = nightActs(makeGame({ vic: 'villager' }, { nightActions: { seer: 'vic', raven: 'vic' } }), { vic: 'villager' });
    list.forEach((a) => Object.values(a).forEach((v) => expect(v).not.toBeUndefined()));
    expect(list[0].by).toBeNull();
  });
});

describe('dayVoteActs', () => {
  it('records each vote, marking a revote as the second ballot', () => {
    const room = makeGame(TABLE, { status: 'day', phase: 2, votes: votesFor({ vic: 'will', sam: 'will' }) });
    expect(dayVoteActs(room)).toEqual([
      { time: 'day', round: 2, act: 'vote', ballot: 1, by: 'vic', target: 'will' },
      { time: 'day', round: 2, act: 'vote', ballot: 1, by: 'sam', target: 'will' },
    ]);
    expect(dayVoteActs({ ...room, revoteTargets: ['will', 'vic'] })[0].ballot).toBe(2);
  });
});

describe('writing the history', () => {
  it('resolveNight appends the night to the history', async () => {
    await resolveNight(ROOM_ID, makeGame(TABLE, { phase: 2, nightActions: { werewolf: 'vic', seer: 'will' } }));
    const history = lastUpdate(updateRoom).history.arrayUnion;
    expect(history.map((a) => a.act)).toEqual(['pack', 'seer']);
  });

  it('resolveLynch and a revote append the day\'s ballots', async () => {
    const room = makeGame(TABLE, { status: 'day', phase: 2, votes: votesFor({ vic: 'will', sam: 'wren' }) });
    await startRevote(ROOM_ID, room, ['will', 'wren']);
    expect(lastUpdate(updateRoom).history.arrayUnion.map((a) => a.ballot)).toEqual([1, 1]);
    await resolveLynch(ROOM_ID, { ...room, revoteTargets: ['will', 'wren'] });
    expect(lastUpdate(updateRoom).history.arrayUnion.map((a) => a.ballot)).toEqual([2, 2]);
  });

  it('the Thief\'s steal is recorded with the Thief, before the role changes', () => {
    const room = makeGame({ tom: 'thief', will: 'werewolf', vic: 'villager' }, {
      phase: 1, nightSubPhase: 'thief', nightActions: { thief: 'seer' },
    });
    const update = advanceNightUpdate(room, 'werewolf');
    expect(update.history.arrayUnion).toEqual([{ time: 'night', round: 1, act: 'thief', by: 'tom', role: 'seer' }]);
  });
});
