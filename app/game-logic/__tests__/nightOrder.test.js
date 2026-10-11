jest.mock('../../firebase/roomService', () => ({}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import { computeNightSequence, nextNightSubPhase, isSubPhaseDone, advanceNightUpdate } from '../gameManager';
import { makeGame } from './helpers';

const VILLAGE = {
  tom: 'thief',
  cora: 'cupid',
  will: 'werewolf',
  sam: 'seer',
  wendy: 'witch',
  sal: 'saviour',
  vic: 'villager',
};
const BOTH_POTIONS = { wendy: { save: true, poison: true } };

describe('computeNightSequence', () => {
  it('night 1 wakes thief, cupid, werewolves — never the seer, witch or saviour', () => {
    const game = makeGame(VILLAGE, { phase: 1, witchPotions: BOTH_POTIONS });
    expect(computeNightSequence(game)).toEqual(['thief', 'cupid', 'werewolf']);
  });

  it('skips the thief when every role they could take was dealt', () => {
    const game = makeGame({ ...VILLAGE, hank: 'hunter' }, { phase: 1 });
    expect(computeNightSequence(game)).toEqual(['cupid', 'werewolf']);
  });

  it('later nights wake saviour, werewolves, witch, seer', () => {
    const game = makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS });
    expect(computeNightSequence(game)).toEqual(['saviour', 'werewolf', 'witch', 'seer']);
  });

  it('keeps waking the witch while one potion is left', () => {
    const game = makeGame(VILLAGE, { phase: 3, witchPotions: { wendy: { save: false, poison: true } } });
    expect(computeNightSequence(game)).toContain('witch');
  });

  it('skips the witch once both potions are used', () => {
    const game = makeGame(VILLAGE, { phase: 3, witchPotions: { wendy: { save: false, poison: false } } });
    expect(computeNightSequence(game)).toEqual(['saviour', 'werewolf', 'seer']);
  });

  it('skips roles whose player is dead or has left', () => {
    const game = makeGame(VILLAGE, {
      phase: 2,
      witchPotions: BOTH_POTIONS,
      dead: ['sam'],
      disconnectedPlayers: ['sal'],
    });
    expect(computeNightSequence(game)).toEqual(['werewolf', 'witch']);
  });

  it('skips a dead witch even with potions left', () => {
    const game = makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS, dead: ['wendy'] });
    expect(computeNightSequence(game)).not.toContain('witch');
  });
});

describe('Classic first night', () => {
  it('wakes the saviour, the hunting wolves, the witch and the seer on night 1', () => {
    const game = makeGame(VILLAGE, { phase: 1, classicFirstNight: true, witchPotions: BOTH_POTIONS });
    expect(computeNightSequence(game)).toEqual(['thief', 'cupid', 'saviour', 'werewolf', 'witch', 'seer']);
  });

  it('the wolves must pick a victim on a classic night 1', () => {
    const room = (nightActions) => ({ phase: 1, classicFirstNight: true, nightActions });
    expect(isSubPhaseDone('werewolf', room({ werewolfObserved: true }))).toBe(false);
    expect(isSubPhaseDone('werewolf', room({ werewolf: 'vic' }))).toBe(true);
  });

  it('does not change later nights', () => {
    const quiet = makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS });
    const classic = makeGame(VILLAGE, { phase: 2, classicFirstNight: true, witchPotions: BOTH_POTIONS });
    expect(computeNightSequence(classic)).toEqual(computeNightSequence(quiet));
  });

  it('the White Wolf still never wakes alone on night 1', () => {
    const game = makeGame({ will: 'werewolf', walt: 'white_wolf', vic: 'villager' }, { phase: 1, classicFirstNight: true });
    expect(computeNightSequence(game)).toEqual(['werewolf']);
  });
});

describe('Wolf Hound and White Wolf steps', () => {
  const PACK = { will: 'werewolf', walt: 'white_wolf', hugo: 'wolf_hound', sam: 'seer', vic: 'villager', vera: 'villager' };

  it('the Wolf Hound chooses on night 1, before the wolves wake', () => {
    expect(computeNightSequence(makeGame(PACK, { phase: 1 }))).toEqual(['wolf_hound', 'werewolf']);
  });

  it('the White Wolf wakes alone only on even nights', () => {
    expect(computeNightSequence(makeGame(PACK, { phase: 2 }))).toEqual(['werewolf', 'white_wolf', 'seer']);
    expect(computeNightSequence(makeGame(PACK, { phase: 3 }))).toEqual(['werewolf', 'seer']);
    expect(computeNightSequence(makeGame(PACK, { phase: 4 }))).toContain('white_wolf');
  });

  it('the White Wolf does not wake alone once no other werewolf is alive', () => {
    expect(computeNightSequence(makeGame(PACK, { phase: 2, dead: ['will'] }))).toEqual(['werewolf', 'seer']);
  });

  it('the pack still hunts when the White Wolf is the only wolf left', () => {
    expect(computeNightSequence(makeGame(PACK, { phase: 3, dead: ['will'] }))).toContain('werewolf');
  });

  it('a Wolf Hound who picks the pack becomes a werewolf before the pack wakes', () => {
    const game = makeGame(PACK, { phase: 1, nightSubPhase: 'wolf_hound', nightActions: { wolfHound: 'werewolf' } });
    const update = advanceNightUpdate(game, 'werewolf');
    expect(update.roles.hugo).toBe('werewolf');
    expect(update.nightSubPhase).toBe('werewolf');
    expect(update.events.arrayUnion).toEqual(['Night 1: The Wolf Hound chose a side.']);
  });

  it('a Wolf Hound who picks the village becomes a villager', () => {
    const game = makeGame(PACK, { phase: 1, nightSubPhase: 'wolf_hound', nightActions: { wolfHound: 'villager' } });
    expect(advanceNightUpdate(game, 'werewolf').roles.hugo).toBe('villager');
  });

  it('other steps only move the night forward', () => {
    const game = makeGame(PACK, { phase: 2, nightSubPhase: 'werewolf', nightActions: { werewolf: 'vic' } });
    expect(advanceNightUpdate(game, 'white_wolf')).toEqual({ nightSubPhase: 'white_wolf' });
  });

  it('a Wolf Hound who never chose keeps their role', () => {
    const game = makeGame(PACK, { phase: 1, nightSubPhase: 'wolf_hound' });
    expect(advanceNightUpdate(game, 'werewolf')).toEqual({ nightSubPhase: 'werewolf' });
  });
});

describe('nextNightSubPhase', () => {
  it('moves to the next step that has someone to act', () => {
    const game = makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS });
    expect(nextNightSubPhase(game, 'saviour')).toBe('werewolf');
    expect(nextNightSubPhase(game, 'werewolf')).toBe('witch');
  });

  it('skips steps with nobody to act', () => {
    const game = makeGame(VILLAGE, { phase: 2, witchPotions: {} });
    expect(nextNightSubPhase(game, 'werewolf')).toBe('seer');
  });

  it('still finds the next step when the current step\'s player has left', () => {
    const game = makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS, disconnectedPlayers: ['sal'] });
    expect(nextNightSubPhase(game, 'saviour')).toBe('werewolf');
  });

  it('returns done after the last step', () => {
    const game = makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS });
    expect(nextNightSubPhase(game, 'seer')).toBe('done');
  });

  it('uses the first-night order on night 1', () => {
    const game = makeGame(VILLAGE, { phase: 1 });
    expect(nextNightSubPhase(game, 'thief')).toBe('cupid');
    expect(nextNightSubPhase(game, 'werewolf')).toBe('done');
  });

  it('the seer first wakes on night 2', () => {
    const night1 = makeGame({ will: 'werewolf', sam: 'seer', vic: 'villager' }, { phase: 1 });
    const night2 = makeGame({ will: 'werewolf', sam: 'seer', vic: 'villager' }, { phase: 2 });
    expect(computeNightSequence(night1)).toEqual(['werewolf']);
    expect(computeNightSequence(night2)).toEqual(['werewolf', 'seer']);
  });
});

describe('isSubPhaseDone', () => {
  const done = (subPhase, nightActions, phase = 2) => isSubPhaseDone(subPhase, { phase, nightActions });

  it('thief, seer and saviour are done once they pick', () => {
    expect(done('thief', {})).toBe(false);
    expect(done('thief', { thief: 'seer' })).toBe(true);
    expect(done('seer', { seer: 'vic' })).toBe(true);
    expect(done('saviour', { saviour: 'vic' })).toBe(true);
  });

  it('cupid is done only with two lovers', () => {
    expect(done('cupid', { cupid: ['a'] })).toBe(false);
    expect(done('cupid', { cupid: ['a', 'b'] })).toBe(true);
  });

  it('werewolves only observe on night 1 and pick a victim later', () => {
    expect(done('werewolf', { werewolfObserved: true }, 1)).toBe(true);
    expect(done('werewolf', { werewolf: 'vic' }, 1)).toBe(false);
    expect(done('werewolf', { werewolfObserved: true }, 2)).toBe(false);
    expect(done('werewolf', { werewolf: 'vic' }, 2)).toBe(true);
  });

  it('the witch is done after saving, poisoning or skipping', () => {
    expect(done('witch', {})).toBe(false);
    expect(done('witch', { witchSave: 'vic' })).toBe(true);
    expect(done('witch', { witchPoison: 'will' })).toBe(true);
    expect(done('witch', { witchSkip: true })).toBe(true);
  });

  it('the Wolf Hound is done once they pick a side', () => {
    expect(done('wolf_hound', {}, 1)).toBe(false);
    expect(done('wolf_hound', { wolfHound: 'werewolf' }, 1)).toBe(true);
  });

  it('the White Wolf is done after devouring or sparing', () => {
    expect(done('white_wolf', {})).toBe(false);
    expect(done('white_wolf', { whiteWolf: 'will' })).toBe(true);
    expect(done('white_wolf', { whiteWolfSkip: true })).toBe(true);
  });

  it('unknown steps are never done', () => {
    expect(done('done', {})).toBe(false);
  });
});
