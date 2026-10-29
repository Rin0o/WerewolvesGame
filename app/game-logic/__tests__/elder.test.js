jest.mock('../../firebase/roomService', () => ({
  updateRoom: jest.fn(() => Promise.resolve()),
  eliminatePlayer: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import { resolveNight, resolveLynch, hunterShoot, computeNightSequence, isIdiotSpared, ELDER_KILLED_EVENT } from '../gameManager';
import { updateRoom } from '../../firebase/roomService';
import { makeGame, votesFor, lastUpdate, eventsOf, ROOM_ID } from './helpers';

const VILLAGE = {
  will: 'werewolf',
  wanda: 'werewolf',
  ed: 'elder',
  sam: 'seer',
  wendy: 'witch',
  sal: 'saviour',
  hank: 'hunter',
  vic: 'villager',
  vera: 'villager',
};
const BOTH_POTIONS = { wendy: { save: true, poison: true } };

function night(nightActions, overrides = {}) {
  return makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS, nightActions, ...overrides });
}

function day(overrides = {}) {
  return makeGame(VILLAGE, { status: 'day', phase: 2, witchPotions: BOTH_POTIONS, ...overrides });
}

async function resolve(game) {
  await resolveNight(ROOM_ID, game);
  return lastUpdate(updateRoom);
}

async function lynch(game) {
  await resolveLynch(ROOM_ID, game);
  return lastUpdate(updateRoom);
}

beforeEach(() => jest.clearAllMocks());

describe('the Elder\'s extra life', () => {
  it('survives the first pack attack, and the night looks peaceful', async () => {
    const update = await resolve(night({ werewolf: 'ed' }));
    expect(update.eliminatedThisNight).toEqual([]);
    expect(update.elderWoundedNight).toBe(2);
    expect(eventsOf(update)).toContain('Night 2: The village was peaceful — no one was eliminated.');
  });

  it('dies to the second wolf attack', async () => {
    const update = await resolve(night({ werewolf: 'ed' }, { phase: 4, elderWoundedNight: 2 }));
    expect(update.nightDeathCauses).toEqual({ ed: 'werewolves' });
    expect(update.elderWoundedNight).toBeUndefined();
  });

  it('the Big Bad Wolf\'s attack also uses up the extra life', async () => {
    const roles = { ...VILLAGE, wanda: 'big_bad_wolf' };
    const first = await resolve(makeGame(roles, { phase: 2, nightActions: { werewolf: 'vic', bigBadWolf: 'ed' } }));
    expect(first.eliminatedThisNight).toEqual(['vic']);
    expect(first.elderWoundedNight).toBe(2);

    const second = await resolve(makeGame(roles, { phase: 3, elderWoundedNight: 2, nightActions: { werewolf: 'vera', bigBadWolf: 'ed' } }));
    expect(second.nightDeathCauses).toEqual({ vera: 'werewolves', ed: 'big_bad_wolf' });
  });

  it('keeps the extra life when the Saviour protects them', async () => {
    const update = await resolve(night({ werewolf: 'ed', saviour: 'ed' }));
    expect(update.eliminatedThisNight).toEqual([]);
    expect(update.elderWoundedNight).toBeUndefined();
  });

  it('keeps the extra life when the Witch saves them, and the potion is used', async () => {
    const update = await resolve(night({ werewolf: 'ed', witchSave: 'ed' }));
    expect(update.elderWoundedNight).toBeUndefined();
    expect(update.witchPotions.wendy.save).toBe(false);
  });

  it('the Wolf-Father\'s bite infects the Elder without using the extra life', async () => {
    const roles = { ...VILLAGE, wanda: 'wolf_father' };
    const update = await resolve(makeGame(roles, { phase: 2, nightActions: { werewolf: 'ed', wolfFather: true } }));
    expect(update.infectedId).toBe('ed');
    expect(update.eliminatedThisNight).toEqual([]);
    expect(update.elderWoundedNight).toBeUndefined();
  });

  it('dies of heartbreak, extra life or not, without costing the village its powers', async () => {
    const update = await resolve(night({ werewolf: 'vic' }, { lovers: ['vic', 'ed'] }));
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves', ed: 'heartbreak' });
    expect(update.villagePowersLost).toBeUndefined();
  });
});

describe('the village kills its Elder', () => {
  it('by the Witch\'s poison: every villager loses their power', async () => {
    const update = await resolve(night({ werewolf: 'vic', witchPoison: 'ed' }));
    expect(update.nightDeathCauses).toEqual({ vic: 'werewolves', ed: 'poison' });
    expect(update.villagePowersLost).toBe(true);
    expect(eventsOf(update)).toContain(`Night 2: ${ELDER_KILLED_EVENT}`);
  });

  it('the poison ignores the extra life', async () => {
    const update = await resolve(night({ witchPoison: 'ed' }));
    expect(update.eliminatedThisNight).toEqual(['ed']);
  });

  it('by a lynch: the powers are gone before the next night is planned', async () => {
    const update = await lynch(day({ votes: votesFor({ will: 'ed', wanda: 'ed', vic: 'ed' }) }));
    expect(update.villagePowersLost).toBe(true);
    expect(eventsOf(update)).toContain(`Day 2: ${ELDER_KILLED_EVENT}`);
    expect(update.nightSubPhase).toBe('werewolf');
  });

  it('by the Hunter\'s shot', async () => {
    await hunterShoot(ROOM_ID, day({ dead: ['hank'], hunterTriggered: 'hank' }), 'ed');
    const update = lastUpdate(updateRoom);
    expect(update.villagePowersLost).toBe(true);
    expect(eventsOf(update)).toContain(ELDER_KILLED_EVENT);
  });

  it('a Hunter who dies with the lynched Elder no longer shoots', async () => {
    const update = await lynch(day({ lovers: ['ed', 'hank'], votes: votesFor({ will: 'ed', wanda: 'ed', vic: 'ed' }) }));
    expect(update.hunterTriggered).toBeNull();
    expect(update.status).toBe('night');
  });

  it('killing someone else changes nothing', async () => {
    const update = await lynch(day({ votes: votesFor({ will: 'vic', wanda: 'vic', ed: 'vic' }) }));
    expect(update.villagePowersLost).toBeUndefined();
  });
});

describe('after the village lost its powers', () => {
  const powerless = { villagePowersLost: true, dead: ['ed'] };

  it('only the wolves wake at night', () => {
    expect(computeNightSequence(night({}, { phase: 3, ...powerless }))).toEqual(['werewolf']);
  });

  it('the Fox and the Raven sleep too, but the wolf roles still wake', () => {
    const roles = { ...VILLAGE, vic: 'fox', vera: 'raven', wanda: 'big_bad_wolf' };
    const game = makeGame(roles, { phase: 3, witchPotions: BOTH_POTIONS, ...powerless });
    expect(computeNightSequence(game)).toEqual(['werewolf', 'big_bad_wolf']);
  });

  it('a Hunter killed by the wolves does not shoot', async () => {
    const update = await resolve(night({ werewolf: 'hank' }, { phase: 3, ...powerless }));
    expect(update.eliminatedThisNight).toEqual(['hank']);
    expect(update.hunterTriggered).toBeNull();
  });

  it('the bears stay silent', async () => {
    const roles = { will: 'werewolf', bea: 'bear_tamer', ed: 'elder', vic: 'villager', vera: 'villager' };
    const update = await resolve(makeGame(roles, { phase: 3, nightActions: {}, ...powerless }));
    expect(update.bearTamerGrowl).toBeNull();
  });

  it('the Village Idiot is no longer spared by the vote', () => {
    const game = makeGame({ ...VILLAGE, vic: 'village_idiot' }, { status: 'day', phase: 3, ...powerless });
    expect(isIdiotSpared(game, 'vic')).toBe(false);
  });
});
