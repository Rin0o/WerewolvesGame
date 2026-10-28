jest.mock('../../firebase/roomService', () => ({
  updateRoom: jest.fn(() => Promise.resolve()),
  eliminatePlayer: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import { resolveNight } from '../gameManager';
import { updateRoom, eliminatePlayer } from '../../firebase/roomService';
import { makeGame, lastUpdate, eventsOf, ROOM_ID } from './helpers';

const VILLAGE = {
  will: 'werewolf',
  wanda: 'werewolf',
  sam: 'seer',
  wendy: 'witch',
  sal: 'saviour',
  hank: 'hunter',
  vic: 'villager',
  vera: 'villager',
};

function village(nightActions, overrides = {}) {
  return makeGame(VILLAGE, {
    phase: 2,
    witchPotions: { wendy: { save: true, poison: true } },
    nightActions,
    ...overrides,
  });
}

async function resolve(game) {
  await resolveNight(ROOM_ID, game);
  return lastUpdate(updateRoom);
}

beforeEach(() => jest.clearAllMocks());

describe('resolveNight — deaths', () => {
  it('the werewolves\' victim dies', async () => {
    const update = await resolve(village({ werewolf: 'vic' }));
    expect(update.eliminatedThisNight).toEqual(['vic']);
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves' });
    expect(eliminatePlayer).toHaveBeenCalledWith(ROOM_ID, 'vic');
    expect(update.status).toBe('day');
    expect(update.winner).toBeNull();
  });

  it('the saviour blocks the wolves and is remembered for next night', async () => {
    const update = await resolve(village({ werewolf: 'vic', saviour: 'vic' }));
    expect(update.eliminatedThisNight).toEqual([]);
    expect(update.saviourLastProtected).toBe('vic');
    expect(eliminatePlayer).not.toHaveBeenCalled();
  });

  it('the saviour does not block the witch\'s poison', async () => {
    const update = await resolve(village({ saviour: 'vic', witchPoison: 'vic' }));
    expect(update.nightDeathCauses).toEqual({ vic: 'poison' });
  });

  it('the witch\'s save potion revives the victim and is used up', async () => {
    const update = await resolve(village({ werewolf: 'vic', witchSave: 'vic' }));
    expect(update.eliminatedThisNight).toEqual([]);
    expect(update.witchPotions.wendy).toEqual({ save: false, poison: true });
  });

  it('the witch\'s poison kills and is used up', async () => {
    const update = await resolve(village({ werewolf: 'vic', witchPoison: 'vera' }));
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves', vera: 'poison' });
    expect(update.witchPotions.wendy).toEqual({ save: true, poison: false });
  });

  it('poisoning the wolves\' victim kills them only once', async () => {
    const update = await resolve(village({ werewolf: 'vic', witchPoison: 'vic' }));
    expect(update.eliminatedThisNight).toEqual(['vic']);
    expect(eliminatePlayer).toHaveBeenCalledTimes(1);
  });

  it('a lover dies of heartbreak with their partner', async () => {
    const update = await resolve(village({ werewolf: 'vic' }, { lovers: ['vic', 'sam'] }));
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves', sam: 'heartbreak' });
    expect(eventsOf(update)).toContain('Sam died of heartbreak after losing their lover.');
  });

  it('a player who left during the night is lost, and the list is cleared', async () => {
    const update = await resolve(village({ werewolf: 'vic' }, { disconnectedPlayers: ['vera'] }));
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves', vera: 'abandoned' });
    expect(update.disconnectedPlayers).toEqual([]);
  });

  it('a peaceful night kills nobody', async () => {
    const update = await resolve(village({}));
    expect(update.eliminatedThisNight).toEqual([]);
    expect(eventsOf(update)).toContain('Night 2: The village was peaceful — no one was eliminated.');
  });
});

describe('resolveNight — night 1', () => {
  it('nobody dies on night 1, even with a wolf target or poison set', async () => {
    const update = await resolve(village({ werewolf: 'vic', witchPoison: 'vera' }, { phase: 1 }));
    expect(update.eliminatedThisNight).toEqual([]);
    expect(eventsOf(update)).toContain('Night 1: The werewolves lurked in the shadows, but did not strike.');
  });

  it('on a classic night 1 the wolves kill and the witch can poison', async () => {
    const update = await resolve(village({ werewolf: 'vic', witchPoison: 'vera' }, { phase: 1, classicFirstNight: true }));
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves', vera: 'poison' });
    expect(eventsOf(update)).not.toContain('Night 1: The werewolves lurked in the shadows, but did not strike.');
  });

  it('on a classic night 1 the witch can save the victim', async () => {
    const update = await resolve(village({ werewolf: 'vic', witchSave: 'vic' }, { phase: 1, classicFirstNight: true }));
    expect(update.eliminatedThisNight).toEqual([]);
    expect(update.witchPotions.wendy.save).toBe(false);
  });

  it('stores cupid\'s lovers', async () => {
    const update = await resolve(village({ cupid: ['vic', 'vera'] }, { phase: 1 }));
    expect(update.lovers).toEqual(['vic', 'vera']);
  });

  it('gives the thief the stolen role', async () => {
    const game = makeGame({ tom: 'thief', will: 'werewolf', vic: 'villager' }, { phase: 1, nightActions: { thief: 'hunter' } });
    const update = await resolve(game);
    expect(update.roles.tom).toBe('hunter');
  });

  it('a thief still holding a stolen Witch at dawn gets her potions', async () => {
    const game = makeGame({ tom: 'thief', will: 'werewolf', vic: 'villager' }, { phase: 1, nightActions: { thief: 'witch' } });
    const update = await resolve(game);
    expect(update.roles.tom).toBe('witch');
    expect(update.witchPotions.tom).toEqual({ save: true, poison: true });
  });

  it('does not swap twice when the thief already took the role during the night', async () => {
    const game = makeGame({ tom: 'seer', will: 'werewolf', vic: 'villager' }, { phase: 1, nightActions: { thief: 'seer' } });
    const update = await resolve(game);
    expect(update.roles.tom).toBe('seer');
    expect(eventsOf(update).filter((e) => e.includes('stole'))).toEqual([]);
  });

  it('resets night actions for the next night', async () => {
    const update = await resolve(village({ cupid: ['vic', 'vera'], seer: 'will' }, { phase: 1 }));
    expect(update.nightActions).toEqual({});
  });
});

describe('resolveNight — Hunter and winners', () => {
  it('a Hunter killed at night gets their shot before any win check', async () => {
    const game = makeGame({ will: 'werewolf', hank: 'hunter', vic: 'villager' }, { nightActions: { werewolf: 'hank' } });
    const update = await resolve(game);
    expect(update.hunterTriggered).toBe('hank');
    expect(update.hunterDiedDuring).toBe('night');
    expect(update.winner).toBeNull();
    expect(update.status).toBe('day');
  });

  it('villagers win when the witch poisons the last werewolf', async () => {
    const game = makeGame(
      { will: 'werewolf', wendy: 'witch', vic: 'villager', vera: 'villager' },
      { nightActions: { werewolf: 'vic', witchPoison: 'will' }, witchPotions: { wendy: { save: true, poison: true } } }
    );
    const update = await resolve(game);
    expect(update.winner).toBe('villagers');
    expect(update.status).toBe('ended');
  });

  it('werewolves win when they equal the rest of the village', async () => {
    const game = makeGame({ will: 'werewolf', vic: 'villager', vera: 'villager' }, { nightActions: { werewolf: 'vic' } });
    const update = await resolve(game);
    expect(update.winner).toBe('werewolves');
    expect(update.status).toBe('ended');
  });
});

describe('resolveNight — White Wolf and Wolf Hound', () => {
  const PACK = { will: 'werewolf', walt: 'white_wolf', vic: 'villager', vera: 'villager', sam: 'seer', hugo: 'wolf_hound' };

  it('the White Wolf devours a werewolf', async () => {
    const update = await resolve(makeGame(PACK, { nightActions: { werewolf: 'vic', whiteWolf: 'will' } }));
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves', will: 'white_wolf' });
    expect(eventsOf(update)).toContain('Night 2: Will was torn apart in the night.');
  });

  it('the White Wolf wins by devouring the last other player', async () => {
    const game = makeGame(PACK, { dead: ['vera', 'sam', 'hugo'], nightActions: { werewolf: 'vic', whiteWolf: 'will' } });
    const update = await resolve(game);
    expect(update.winner).toBe('white_wolf');
    expect(update.status).toBe('ended');
  });

  it('a Wolf Hound choice still pending at dawn is applied', async () => {
    const update = await resolve(makeGame(PACK, { phase: 1, nightActions: { wolfHound: 'werewolf' } }));
    expect(update.roles.hugo).toBe('werewolf');
    expect(eventsOf(update)).toContain('Night 1: The Wolf Hound chose a side.');
  });

  it('a poisoned night is not called peaceful', async () => {
    const update = await resolve(village({ witchPoison: 'vera' }));
    expect(eventsOf(update)).not.toContain('Night 2: The village was peaceful — no one was eliminated.');
  });
});

describe('resolveNight — Bear Tamer', () => {
  it('the bears growl at the White Wolf too', async () => {
    const game = makeGame({ bea: 'bear_tamer', walt: 'white_wolf', vic: 'villager', vera: 'villager', will: 'werewolf', sam: 'seer' });
    expect((await resolve(game)).bearTamerGrowl).toBe(true);
  });

  it('the bears growl when a living neighbour is a werewolf, wrapping around the table', async () => {
    const game = makeGame({ bea: 'bear_tamer', vic: 'villager', vera: 'villager', sam: 'seer', will: 'werewolf' });
    expect((await resolve(game)).bearTamerGrowl).toBe(true);
  });

  it('the bears stay quiet when neither neighbour is a werewolf', async () => {
    const game = makeGame({ vic: 'villager', bea: 'bear_tamer', vera: 'villager', will: 'werewolf', sam: 'seer' });
    expect((await resolve(game)).bearTamerGrowl).toBe(false);
  });

  it('skips neighbours who died tonight', async () => {
    const game = makeGame(
      { vic: 'villager', bea: 'bear_tamer', vera: 'villager', will: 'werewolf', sam: 'seer', sal: 'saviour' },
      { nightActions: { werewolf: 'vera' } }
    );
    expect((await resolve(game)).bearTamerGrowl).toBe(true);
  });

  it('the narrator has no seat, so the bears look past them', async () => {
    const game = makeGame({ bea: 'bear_tamer', vic: 'villager', vera: 'villager', sam: 'seer', will: 'werewolf' });
    game.players.unshift({ id: 'nora', nickname: 'Nora', isAlive: true, isHost: true, isReady: true, isNarrator: true });
    expect((await resolve(game)).bearTamerGrowl).toBe(true);
  });

  it('is null when the Bear Tamer is dead', async () => {
    const game = makeGame({ bea: 'bear_tamer', will: 'werewolf', vic: 'villager', vera: 'villager', sam: 'seer' }, { dead: ['bea'] });
    expect((await resolve(game)).bearTamerGrowl).toBeNull();
  });

  it('is null when there is no Bear Tamer', async () => {
    expect((await resolve(village({}))).bearTamerGrowl).toBeNull();
  });
});

describe('resolveNight — Fox', () => {
  const foxGame = (nightActions, overrides = {}) => makeGame({ ...VILLAGE, fox: 'fox' }, { nightActions, ...overrides });

  it('keeps the power when a wolf was among the three', async () => {
    expect((await resolve(foxGame({ fox: 'sam' }))).foxPowerLost).toBe(false);
  });

  it('loses the power when none of the three is a wolf', async () => {
    expect((await resolve(foxGame({ fox: 'hank' }))).foxPowerLost).toBe(true);
  });

  it('sniffs the table as it was before tonight\'s deaths', async () => {
    const game = makeGame(
      { fox: 'fox', vic: 'villager', will: 'werewolf', vera: 'villager', sam: 'seer', wendy: 'witch' },
      { witchPotions: { wendy: { save: true, poison: true } }, nightActions: { fox: 'vic', witchPoison: 'will' } }
    );
    const update = await resolve(game);
    expect(update.eliminatedThisNight).toEqual(['will']);
    expect(update.foxPowerLost).toBe(false);
  });

  it('keeps the power when the Fox stayed hidden', async () => {
    expect((await resolve(foxGame({ foxSkip: true }))).foxPowerLost).toBe(false);
  });

  it('never gets the power back', async () => {
    expect((await resolve(foxGame({}, { foxPowerLost: true }))).foxPowerLost).toBe(true);
  });
});

describe('resolveNight — Raven', () => {
  const ROLES = { ...VILLAGE, rae: 'raven' };
  const night = (nightActions, overrides = {}) => village(nightActions, { roles: ROLES, players: makeGame(ROLES).players, ...overrides });

  it('publishes the mark at dawn, without naming the Raven', async () => {
    const update = await resolve(night({ raven: 'vera' }));
    expect(update.ravenMark).toBe('vera');
    expect(eventsOf(update)).toContain('Night 2: The raven marked Vera, who starts today\'s vote with 2 votes against them.');
    expect(eventsOf(update).join(' ')).not.toMatch(/Rae/);
  });

  it('loses the mark when the marked player dies that night', async () => {
    const update = await resolve(night({ raven: 'vera', werewolf: 'vera' }));
    expect(update.ravenMark).toBeNull();
    expect(eventsOf(update).join(' ')).not.toMatch(/raven/);
  });

  it('keeps the mark when the Raven itself dies that night', async () => {
    expect((await resolve(night({ raven: 'vera', werewolf: 'rae' }))).ravenMark).toBe('vera');
  });

  it('clears any old mark when the Raven passes', async () => {
    expect((await resolve(night({ ravenSkip: true }, { ravenMark: 'vic' }))).ravenMark).toBeNull();
  });
});

describe('resolveNight — Wild Child', () => {
  const ROLES = { ...VILLAGE, kid: 'wild_child' };
  const night = (nightActions, overrides = {}) => village(nightActions, { roles: ROLES, ...overrides });
  const withKid = makeGame(ROLES).players;

  it('remembers who the Wild Child chose on night 1', async () => {
    const update = await resolve(night({ wildChild: 'vic' }, { phase: 1, players: withKid }));
    expect(update).toMatchObject({ wildChildId: 'kid', wildChildModel: 'vic' });
    expect(update.roles.kid).toBe('wild_child');
    expect(update.wildChildTurnedAt).toBeUndefined();
  });

  it('becomes a werewolf when the wolves kill its role model', async () => {
    const update = await resolve(night({ werewolf: 'vic' }, { players: withKid, wildChildId: 'kid', wildChildModel: 'vic' }));
    expect(update.roles.kid).toBe('werewolf');
    expect(update.wildChildTurnedAt).toEqual(expect.any(String));
    expect(update.eliminatedThisNight).toEqual(['vic']);
  });

  it('turns on a classic night 1 when the model it just chose is killed', async () => {
    const game = night({ wildChild: 'vic', werewolf: 'vic' }, { phase: 1, classicFirstNight: true, players: withKid });
    expect((await resolve(game)).roles.kid).toBe('werewolf');
  });

  it('turns when its role model dies of heartbreak', async () => {
    const game = night({ werewolf: 'vera' }, { players: withKid, wildChildId: 'kid', wildChildModel: 'vic', lovers: ['vera', 'vic'] });
    expect((await resolve(game)).roles.kid).toBe('werewolf');
  });

  it('stays a villager while its role model lives', async () => {
    const update = await resolve(night({ werewolf: 'vera' }, { players: withKid, wildChildId: 'kid', wildChildModel: 'vic' }));
    expect(update.roles.kid).toBe('wild_child');
  });

  it('does not turn when it dies the same night as its role model', async () => {
    const game = night({ werewolf: 'vic', witchPoison: 'kid' }, { players: withKid, wildChildId: 'kid', wildChildModel: 'vic' });
    expect((await resolve(game)).roles.kid).toBe('wild_child');
  });
});
