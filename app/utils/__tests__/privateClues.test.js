import { privateClues, addClues } from '../privateClues';
import { makeGame } from '../../game-logic/__tests__/helpers';

const TABLE = {
  will: 'werewolf',
  fox: 'fox',
  sam: 'seer',
  cy: 'cupid',
  vic: 'villager',
  bea: 'bear_tamer',
  rae: 'raven',
  kid: 'wild_child',
};

const night = (nightActions, overrides = {}) => makeGame(TABLE, { phase: 3, nightActions, ...overrides });
const day = (overrides = {}) => makeGame(TABLE, { status: 'day', phase: 3, bearTamerGrowl: false, ...overrides });
const NO_NOTES = { notes: '', suspicions: {}, suspectedRoles: {}, clues: [] };

describe('privateClues', () => {
  it('records the Seer\'s vision and suspects or clears the player seen', () => {
    const [wolf] = privateClues(night({ seer: 'will' }), 'sam');
    expect(wolf.text).toBe('Night 3: your vision showed that Will is a Werewolf.');
    expect(wolf.suspicions).toEqual({ will: 'very_suspicious' });
    const [clear] = privateClues(night({ seer: 'vic' }), 'sam');
    expect(clear.text).toBe('Night 3: your vision showed that Vic is not a Werewolf.');
    expect(clear.suspicions).toEqual({ vic: 'innocent' });
  });

  it('sees an infected player as a werewolf, as the Seer\'s card does', () => {
    const [clue] = privateClues(night({ seer: 'vic' }, { infectedId: 'vic' }), 'sam');
    expect(clue.suspicions).toEqual({ vic: 'very_suspicious' });
  });

  it('records the Fox\'s group, never suspecting the Fox itself', () => {
    const [found] = privateClues(night({ fox: 'will' }), 'fox');
    expect(found.text).toBe('Night 3: you sniffed Kid, Will and you: a Werewolf is among them.');
    expect(found.suspicions).toEqual({ kid: 'suspicious', will: 'suspicious' });
    const [none] = privateClues(night({ fox: 'cy' }), 'fox');
    expect(none.text).toBe('Night 3: you sniffed Sam, Cy and Vic: no Werewolf among them.');
    expect(none.suspicions).toEqual({ sam: 'innocent', cy: 'innocent', vic: 'innocent' });
  });

  it('records who the Raven marked', () => {
    expect(privateClues(night({ raven: 'vic' }), 'rae')).toEqual([{ key: 'raven-3', text: 'Night 3: you marked Vic.' }]);
  });

  it('records what the Bear Tamer\'s bears said about the living neighbours', () => {
    const [silent] = privateClues(day(), 'bea');
    expect(silent.text).toBe('Day 3: your bears were silent. Neither Vic nor Rae is a Werewolf.');
    expect(silent.suspicions).toEqual({ vic: 'innocent', rae: 'innocent' });
    const [growl] = privateClues(day({ bearTamerGrowl: true, dead: ['rae'] }), 'bea');
    expect(growl.text).toBe('Day 3: your bears growled. Vic or Kid is a Werewolf.');
    expect(growl.suspicions).toEqual({ vic: 'suspicious', kid: 'suspicious' });
  });

  it('records the lovers for each lover and for Cupid', () => {
    const room = day({ lovers: ['vic', 'will'] });
    expect(privateClues(room, 'vic').map((c) => c.text)).toEqual([
      'Cupid\'s arrow: your lover is Will. If one of you dies, so does the other.',
    ]);
    expect(privateClues(room, 'cy').map((c) => c.text)).toEqual(['You made Vic and Will lovers.']);
  });

  it('records the Wild Child\'s role model', () => {
    const [clue] = privateClues(day({ wildChildId: 'kid', wildChildModel: 'sam' }), 'kid');
    expect(clue.text).toBe('Your role model is Sam. If they die, you become a Werewolf.');
  });

  it('tells nothing to other players, the narrator, or in the lobby', () => {
    const room = night({ seer: 'will', fox: 'will', raven: 'vic' });
    expect(privateClues(room, 'vic')).toEqual([]);
    expect(privateClues(room, 'will')).toEqual([]);
    const withNarrator = { ...room, players: [...room.players, { id: 'nora', nickname: 'Nora', isAlive: true, isNarrator: true }] };
    expect(privateClues(withNarrator, 'nora')).toEqual([]);
    expect(privateClues({ ...room, status: 'lobby' }, 'sam')).toEqual([]);
  });

  it('ignores night actions once the night is over', () => {
    expect(privateClues(day({ nightActions: { seer: 'will' } }), 'sam')).toEqual([]);
  });
});

describe('addClues', () => {
  const seerClue = { key: 'seer-3', text: 'Will is a Werewolf.', suspicions: { will: 'very_suspicious' } };

  it('adds a new clue and sets the suspicion of the player it names', () => {
    const next = addClues(NO_NOTES, [seerClue]);
    expect(next.clues).toEqual([{ key: 'seer-3', text: 'Will is a Werewolf.' }]);
    expect(next.suspicions).toEqual({ will: 'very_suspicious' });
  });

  it('never overrides a suspicion the player already set', () => {
    const next = addClues({ ...NO_NOTES, suspicions: { will: 'neutral' } }, [seerClue]);
    expect(next.suspicions).toEqual({ will: 'neutral' });
  });

  it('records each clue once, so a suspicion changed later stays changed', () => {
    const once = addClues(NO_NOTES, [seerClue]);
    const changed = { ...once, suspicions: { will: 'innocent' } };
    expect(addClues(changed, [seerClue])).toBe(changed);
  });
});
