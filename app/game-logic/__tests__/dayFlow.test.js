jest.mock('../../firebase/roomService', () => ({
  getRoom: jest.fn(),
  updateRoom: jest.fn(() => Promise.resolve()),
  eliminatePlayer: jest.fn(() => Promise.resolve()),
  clearNightActions: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import { resolveLynch, hunterShoot, startNextNight, tiedForRevote, startRevote, TIE_RULE } from '../gameManager';
import { getRoom, updateRoom, eliminatePlayer, clearNightActions } from '../../firebase/roomService';
import { makeGame, votesFor, lastUpdate, eventsOf, ROOM_ID } from './helpers';

const VILLAGE = {
  will: 'werewolf',
  wanda: 'werewolf',
  sam: 'seer',
  sal: 'saviour',
  hank: 'hunter',
  vic: 'villager',
  vera: 'villager',
};

function day(roles, overrides = {}) {
  return makeGame(roles, { status: 'day', phase: 2, ...overrides });
}

async function lynch(game) {
  await resolveLynch(ROOM_ID, game);
  return lastUpdate(updateRoom);
}

beforeEach(() => jest.clearAllMocks());

describe('tie rule', () => {
  const tied = votesFor({ sam: 'will', vic: 'vera', sal: 'will', hank: 'vera', wanda: 'sam' });

  it('a tie with the default rule lynches nobody without a revote', () => {
    expect(tiedForRevote(day(VILLAGE, { votes: tied }))).toBeNull();
  });

  it('a tie with the revote rule asks for a new vote between the tied players only', () => {
    expect(tiedForRevote(day(VILLAGE, { votes: tied, tieRule: TIE_RULE.REVOTE })).sort()).toEqual(['vera', 'will']);
  });

  it('there is only one revote: a second tie lynches nobody', () => {
    const room = day(VILLAGE, { votes: tied, tieRule: TIE_RULE.REVOTE, revoteTargets: ['vera', 'will'] });
    expect(tiedForRevote(room)).toBeNull();
  });

  it('a clear result needs no revote', () => {
    const room = day(VILLAGE, { votes: votesFor({ sam: 'will', vic: 'will', sal: 'vera' }), tieRule: TIE_RULE.REVOTE });
    expect(tiedForRevote(room)).toBeNull();
  });

  it('starting a revote clears the votes and records the tied players', async () => {
    await startRevote(ROOM_ID, day(VILLAGE, { votesClosed: true }), ['will', 'vera']);
    const update = lastUpdate(updateRoom);
    expect(update).toMatchObject({ votes: {}, votesClosed: false, revoteTargets: ['will', 'vera'] });
    expect(eventsOf(update)).toEqual(['Day 2: The vote was tied between Will and Vera. The village votes again.']);
  });

  it('the lynch that follows clears the revote', async () => {
    const update = await lynch(day(VILLAGE, { votes: tied, revoteTargets: ['vera', 'will'] }));
    expect(update.revoteTargets).toBeNull();
    expect(eliminatePlayer).not.toHaveBeenCalled();
  });
});

describe('resolveLynch', () => {
  it('lynches the top-voted player and starts the next night', async () => {
    const update = await lynch(day(VILLAGE, { votes: votesFor({ sam: 'vic', sal: 'vic', will: 'vic', vic: 'will' }) }));
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'vic');
    expect(update.status).toBe('night');
    expect(update.phase).toBe(3);
    expect(update.nightSubPhase).toBe('saviour');
    expect(update.votes).toEqual({});
    expect(update.nightActions).toEqual({});
  });

  it('plans the next night without the lynched player', async () => {
    const update = await lynch(day(VILLAGE, { votes: votesFor({ sam: 'sal', vic: 'sal', vera: 'sal' }) }));
    expect(update.nightSubPhase).toBe('werewolf');
  });

  it('lynches nobody on a tie and still moves to night', async () => {
    const update = await lynch(day(VILLAGE, { votes: votesFor({ sam: 'will', vic: 'vera' }) }));
    expect(eliminatePlayer).not.toHaveBeenCalled();
    expect(update.status).toBe('night');
    expect(eventsOf(update)[0]).toMatch(/tie/);
  });

  it('lynches nobody without votes', async () => {
    const update = await lynch(day(VILLAGE));
    expect(eliminatePlayer).not.toHaveBeenCalled();
    expect(eventsOf(update)).toEqual(['Day 2: No votes were confirmed — the village remains divided.']);
  });

  it('a lynched lover takes their partner with them', async () => {
    await lynch(day(VILLAGE, { lovers: ['vic', 'sam'], votes: votesFor({ will: 'vic', wanda: 'vic', vera: 'sam' }) }));
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'vic');
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'sam');
  });

  it('players who left during the day are lost', async () => {
    await lynch(day(VILLAGE, { disconnectedPlayers: ['vera'] }));
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'vera');
    expect(lastUpdate(updateRoom).disconnectedPlayers).toEqual([]);
  });

  it('a lynched Hunter keeps the game in the day for their shot', async () => {
    const update = await lynch(day(VILLAGE, { votes: votesFor({ will: 'hank', wanda: 'hank' }) }));
    expect(update.status).toBe('day');
    expect(update.hunterTriggered).toBe('hank');
    expect(update.hunterDiedDuring).toBe('day');
    expect(update.phase).toBeUndefined();
  });

  it('villagers win by lynching the last werewolf', async () => {
    const update = await lynch(day({ will: 'werewolf', vic: 'villager', vera: 'villager' }, { votes: votesFor({ vic: 'will', vera: 'will' }) }));
    expect(update.winner).toBe('villagers');
    expect(update.status).toBe('ended');
    expect(update.phase).toBeUndefined();
  });

  it('werewolves win when a lynch leaves them equal to the village', async () => {
    const update = await lynch(day({ will: 'werewolf', vic: 'villager', vera: 'villager' }, { votes: votesFor({ will: 'vic', vera: 'vic' }) }));
    expect(update.winner).toBe('werewolves');
  });
});

describe('hunterShoot', () => {
  const afterHunterDied = (overrides) =>
    day({ will: 'werewolf', wanda: 'werewolf', hank: 'hunter', vic: 'villager', vera: 'villager', sam: 'seer' }, {
      dead: ['hank'],
      hunterTriggered: 'hank',
      ...overrides,
    });

  it('kills the target and clears the pending shot', async () => {
    await hunterShoot(ROOM_ID, afterHunterDied(), 'will');
    const update = lastUpdate(updateRoom);
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'will');
    expect(update.hunterTriggered).toBeNull();
    expect(update.winner).toBeNull();
    expect(update.status).toBe('day');
  });

  it('the shot can win the game', async () => {
    const game = day({ will: 'werewolf', hank: 'hunter', vic: 'villager', vera: 'villager' }, { dead: ['hank'] });
    const { winner } = await hunterShoot(ROOM_ID, game, 'will');
    expect(winner).toBe('villagers');
    expect(lastUpdate(updateRoom).status).toBe('ended');
  });

  it('shooting a lover also kills their partner', async () => {
    await hunterShoot(ROOM_ID, afterHunterDied({ lovers: ['vic', 'vera'] }), 'vic');
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'vera');
    expect(eventsOf(lastUpdate(updateRoom))).toContain('Vera died of heartbreak after losing their lover.');
  });
});

describe('startNextNight', () => {
  const freshRoom = (overrides) => day(VILLAGE, { dead: ['hank'], ...overrides });

  it('starts the next night from a fresh read of the room', async () => {
    getRoom.mockResolvedValue(freshRoom({ dead: ['hank', 'sal'] }));
    await startNextNight(ROOM_ID);
    expect(getRoom).toHaveBeenCalledWith(ROOM_ID);
    expect(clearNightActions).toHaveBeenCalledWith(ROOM_ID);
    const update = lastUpdate(updateRoom);
    expect(update.status).toBe('night');
    expect(update.phase).toBe(3);
    expect(update.nightSubPhase).toBe('werewolf');
    expect(update.hunterTriggered).toBeNull();
  });

  it.each([
    ['the room is gone', null],
    ['it is already night', { status: 'night' }],
    ['the game has a winner', { winner: 'villagers' }],
    ['a Hunter shot is still pending', { hunterTriggered: 'hank' }],
  ])('does nothing when %s', async (_, overrides) => {
    getRoom.mockResolvedValue(overrides && freshRoom(overrides));
    await startNextNight(ROOM_ID);
    expect(updateRoom).not.toHaveBeenCalled();
  });
});

describe('the Raven\'s mark at the vote', () => {
  const ROLES = { ...VILLAGE, rae: 'raven' };

  it('the 2 extra votes lynch the marked player', async () => {
    const game = day(ROLES, { ravenMark: 'vera', votes: votesFor({ will: 'sam', wanda: 'sam', vic: 'vera' }) });
    await lynch(game);
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'vera');
  });

  it('lynches the marked player even when nobody votes', async () => {
    await lynch(day(ROLES, { ravenMark: 'vera', votes: {} }));
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'vera');
  });

  it('can create a tie, which then goes to a revote without the 2 votes', () => {
    const game = day(ROLES, { tieRule: TIE_RULE.REVOTE, ravenMark: 'vera', votes: votesFor({ will: 'sam', wanda: 'sam' }) });
    expect(tiedForRevote(game).sort()).toEqual(['sam', 'vera']);
  });

  it('does not count in the revote', async () => {
    const game = day(ROLES, { ravenMark: 'vera', revoteTargets: ['sam', 'vera'], votes: votesFor({ will: 'sam' }) });
    await lynch(game);
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'sam');
  });

  it('is cleared once the day is resolved', async () => {
    expect((await lynch(day(ROLES, { ravenMark: 'vera', votes: votesFor({ will: 'vera' }) }))).ravenMark).toBeNull();
  });
});

describe('the Village Idiot', () => {
  const ROLES = { ...VILLAGE, ida: 'village_idiot' };
  const voteOutIda = votesFor({ will: 'ida', wanda: 'ida', sam: 'ida', vic: 'ida' });

  it('survives the first lynch, is revealed and loses the vote', async () => {
    const update = await lynch(day(ROLES, { votes: voteOutIda }));
    expect(update.idiotRevealed).toBe('ida');
    expect(eliminatePlayer).not.toHaveBeenCalled();
    expect(eventsOf(update)).toEqual([
      'Day 2: Ida was voted out, but turned out to be the Village Idiot. The village spared them, but they can no longer vote.',
    ]);
    expect(update.status).toBe('night');
  });

  it('dies when the village votes them out a second time', async () => {
    const update = await lynch(day(ROLES, { votes: voteOutIda, idiotRevealed: 'ida' }));
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'ida');
    expect(update.idiotRevealed).toBeUndefined();
  });

  it('takes no lover down when spared', async () => {
    await lynch(day(ROLES, { votes: voteOutIda, lovers: ['ida', 'vic'] }));
    expect(eliminatePlayer).not.toHaveBeenCalled();
  });

  it('is not saved from the Hunter\'s shot', async () => {
    const game = day(ROLES, { dead: ['hank'], hunterTriggered: 'hank', hunterDiedDuring: 'day' });
    await hunterShoot(ROOM_ID, game, 'ida');
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'ida');
  });
});

describe('the Wild Child by day', () => {
  const ROLES = { will: 'werewolf', kid: 'wild_child', sam: 'seer', vic: 'villager', vera: 'villager', hank: 'hunter' };
  const withChild = (roles, overrides = {}) => day(roles, { wildChildId: 'kid', wildChildModel: 'vic', ...overrides });

  it('becomes a werewolf when the village lynches its role model, and wakes with the pack', async () => {
    const update = await lynch(withChild(ROLES, { votes: votesFor({ will: 'vic', sam: 'vic', vera: 'vic' }) }));
    expect(update.roles.kid).toBe('werewolf');
    expect(update.wildChildTurnedAt).toEqual(expect.any(String));
    expect(update.status).toBe('night');
    expect(update.nightSubPhase).toBe('werewolf');
  });

  it('counts as a wolf in the win check straight away', async () => {
    const small = { will: 'werewolf', kid: 'wild_child', vic: 'villager', vera: 'villager' };
    const update = await lynch(withChild(small, { votes: votesFor({ will: 'vic', vera: 'vic' }) }));
    expect(update.winner).toBe('werewolves');
  });

  it('stays a villager when someone else is lynched', async () => {
    const update = await lynch(withChild(ROLES, { votes: votesFor({ will: 'vera', sam: 'vera' }) }));
    expect(update.roles).toBeUndefined();
    expect(update.wildChildTurnedAt).toBeUndefined();
  });

  it('does not turn when it dies with its role model', async () => {
    const lovers = { lovers: ['vic', 'kid'], votes: votesFor({ will: 'vic', sam: 'vic' }) };
    expect((await lynch(withChild(ROLES, lovers))).roles).toBeUndefined();
  });

  it('is turned by the Hunter\'s last shot at its role model', async () => {
    const game = withChild(ROLES, { dead: ['hank'], hunterTriggered: 'hank', hunterDiedDuring: 'day' });
    await hunterShoot(ROOM_ID, game, 'vic');
    const update = lastUpdate(updateRoom);
    expect(update.roles).toEqual({ ...ROLES, kid: 'werewolf' });
    expect(update.wildChildTurnedAt).toEqual(expect.any(String));
  });
});
