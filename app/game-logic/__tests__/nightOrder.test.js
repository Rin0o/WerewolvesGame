jest.mock('../../firebase/roomService', () => ({}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import { computeNightSequence, nextNightSubPhase, isSubPhaseDone } from '../gameManager';
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

  it('unknown steps are never done', () => {
    expect(done('done', {})).toBe(false);
  });
});
