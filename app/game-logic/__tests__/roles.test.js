import {
  assignRoles,
  checkWinCondition,
  foxSmellsWolf,
  getAvailableRolesForThief,
  getFoxGroup,
  getLivingNeighbours,
  getLoversPartner,
  getPlayerWithRole,
  getSeating,
  getSisters,
  getWerewolves,
  rolesInPlay,
} from '../roles';
import { ROLE, ROLE_DEFINITIONS, getCompositionForCount, buildCustomComposition } from '../../constants/roles';
import { makeGame, countRoles } from './helpers';

function players(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, nickname: `P${i}`, isAlive: true }));
}

describe('getCompositionForCount', () => {
  it('returns one role per player from 2 to 20 players', () => {
    for (let count = 2; count <= 20; count++) {
      expect(getCompositionForCount(count)).toHaveLength(count);
    }
  });

  it('always includes at least one werewolf', () => {
    for (let count = 2; count <= 20; count++) {
      expect(getCompositionForCount(count)).toContain(ROLE.WEREWOLF);
    }
  });

  it('adds one villager per player above 13', () => {
    const thirteen = countRoles(getCompositionForCount(13));
    const sixteen = countRoles(getCompositionForCount(16));
    expect(sixteen[ROLE.VILLAGER] || 0).toBe((thirteen[ROLE.VILLAGER] || 0) + 3);
    expect(sixteen[ROLE.WEREWOLF]).toBe(thirteen[ROLE.WEREWOLF]);
  });

  it('adds a fifth werewolf from 18 players', () => {
    expect(countRoles(getCompositionForCount(17))[ROLE.WEREWOLF]).toBe(4);
    expect(countRoles(getCompositionForCount(18))[ROLE.WEREWOLF]).toBe(5);
    expect(countRoles(getCompositionForCount(20))[ROLE.WEREWOLF]).toBe(5);
  });

  it('never deals the Thief in Normal games, where every role they could take is already dealt', () => {
    for (let count = 5; count <= 20; count++) {
      expect(getCompositionForCount(count)).not.toContain(ROLE.THIEF);
    }
  });

  it('returns a fresh array the caller can change', () => {
    getCompositionForCount(8).push(ROLE.VILLAGER);
    expect(getCompositionForCount(8)).toHaveLength(8);
  });

  it('returns no roles for fewer than 2 players', () => {
    expect(getCompositionForCount(1)).toEqual([]);
  });
});

describe('buildCustomComposition', () => {
  it('fills the remaining slots with villagers', () => {
    const comp = buildCustomComposition({ playerCount: 8, werewolf: 2, seer: true, witch: true });
    expect(countRoles(comp)).toEqual({ werewolf: 2, seer: 1, witch: 1, villager: 4 });
  });

  it('adds the White Wolf and Wolf Hound as their own slots', () => {
    const comp = buildCustomComposition({ playerCount: 7, werewolf: 1, white_wolf: true, wolf_hound: true });
    expect(countRoles(comp)).toEqual({ werewolf: 1, white_wolf: 1, wolf_hound: 1, villager: 4 });
  });

  it('adds two sisters for the sister toggle', () => {
    const comp = buildCustomComposition({ playerCount: 6, werewolf: 1, sister: true });
    expect(countRoles(comp)).toEqual({ werewolf: 1, sister: 2, villager: 3 });
  });
});

describe('assignRoles', () => {
  it('deals exactly the composition, one role per player', () => {
    const group = players(9);
    const { roleMap } = assignRoles(group);
    expect(Object.keys(roleMap).sort()).toEqual(group.map((p) => p.id).sort());
    expect(countRoles(Object.values(roleMap))).toEqual(countRoles(getCompositionForCount(9)));
  });

  it('uses a custom composition when given', () => {
    const comp = buildCustomComposition({ playerCount: 5, werewolf: 2, hunter: true });
    const { roleMap } = assignRoles(players(5), comp);
    expect(countRoles(Object.values(roleMap))).toEqual(countRoles(comp));
  });

  it('gives the witch both potions and nobody else any', () => {
    const { roleMap, witchPotions } = assignRoles(players(8));
    const witch = getPlayerWithRole(roleMap, ROLE.WITCH);
    expect(witchPotions).toEqual({ [witch]: { save: true, poison: true } });
  });

  it('never deals a role to the narrator', () => {
    const group = [...players(6), { id: 'narrator', nickname: 'N', isAlive: true, isNarrator: true }];
    const { roleMap } = assignRoles(group);
    expect(roleMap.narrator).toBeUndefined();
    expect(Object.keys(roleMap)).toHaveLength(6);
  });

  it('deals roles randomly from game to game', () => {
    const rolesOfFirstPlayer = new Set();
    for (let i = 0; i < 200; i++) rolesOfFirstPlayer.add(assignRoles(players(6)).roleMap.p0);
    expect(rolesOfFirstPlayer.size).toBeGreaterThan(1);
    expect(rolesOfFirstPlayer).toContain(ROLE.WEREWOLF);
  });
});

describe('checkWinCondition', () => {
  it('villagers win when no werewolf is alive', () => {
    const game = makeGame({ w: 'werewolf', a: 'villager', b: 'seer' }, { dead: ['w'] });
    expect(checkWinCondition(game.players, game.roles)).toBe('villagers');
  });

  it('the Big Bad Wolf counts as part of the pack', () => {
    const alone = makeGame({ bbw: 'big_bad_wolf', a: 'villager', b: 'seer' }, { dead: ['b'] });
    expect(checkWinCondition(alone.players, alone.roles)).toBe('werewolves');
    const villagersLeft = makeGame({ bbw: 'big_bad_wolf', a: 'villager', b: 'seer', c: 'villager' });
    expect(checkWinCondition(villagersLeft.players, villagersLeft.roles)).toBeNull();
  });

  it('werewolves win when they are at least as many as everyone else', () => {
    const game = makeGame({ w: 'werewolf', a: 'villager', b: 'seer' }, { dead: ['b'] });
    expect(checkWinCondition(game.players, game.roles)).toBe('werewolves');
  });

  it('nobody wins while villagers outnumber the werewolves', () => {
    const game = makeGame({ w: 'werewolf', a: 'villager', b: 'seer' });
    expect(checkWinCondition(game.players, game.roles)).toBeNull();
  });

  it('lovers win when they are the last two alive, even a wolf and a villager', () => {
    const game = makeGame({ w: 'werewolf', a: 'villager', b: 'seer' }, { dead: ['b'] });
    expect(checkWinCondition(game.players, game.roles, ['w', 'a'])).toBe('lovers');
  });

  it('lovers do not win while a third player is alive', () => {
    const game = makeGame({ w: 'werewolf', x: 'werewolf', a: 'villager', b: 'seer' }, { dead: ['b'] });
    expect(checkWinCondition(game.players, game.roles, ['w', 'a'])).toBe('werewolves');
  });

  it('the White Wolf wins as the last player alive', () => {
    const game = makeGame({ ww: 'white_wolf', w: 'werewolf', a: 'villager' }, { dead: ['w', 'a'] });
    expect(checkWinCondition(game.players, game.roles)).toBe('white_wolf');
  });

  it('a living White Wolf keeps the villagers from winning', () => {
    const game = makeGame({ ww: 'white_wolf', w: 'werewolf', a: 'villager', b: 'seer' }, { dead: ['w'] });
    expect(checkWinCondition(game.players, game.roles)).toBeNull();
  });

  it('the pack must match everyone else, White Wolf included', () => {
    const tied = makeGame({ ww: 'white_wolf', w: 'werewolf', a: 'villager' });
    expect(checkWinCondition(tied.players, tied.roles)).toBeNull();
    const outnumbered = makeGame({ ww: 'white_wolf', w1: 'werewolf', w2: 'werewolf', a: 'villager' });
    expect(checkWinCondition(outnumbered.players, outnumbered.roles)).toBe('werewolves');
  });

  it('villagers win once the pack and the White Wolf are dead', () => {
    const game = makeGame({ ww: 'white_wolf', w: 'werewolf', a: 'villager' }, { dead: ['ww', 'w'] });
    expect(checkWinCondition(game.players, game.roles)).toBe('villagers');
  });

  it('a Wolf Hound who never chose counts as a villager', () => {
    const game = makeGame({ w: 'werewolf', h: 'wolf_hound', a: 'villager' });
    expect(checkWinCondition(game.players, game.roles)).toBeNull();
  });

  it('ignores the narrator', () => {
    const game = makeGame({ w: 'werewolf', a: 'villager' });
    const withNarrator = [...game.players, { id: 'n', nickname: 'N', isAlive: true, isNarrator: true }];
    expect(checkWinCondition(withNarrator, game.roles)).toBe('werewolves');
  });
});

describe('role helpers', () => {
  const roles = { t: 'thief', w1: 'werewolf', w2: 'werewolf', s1: 'sister', s2: 'sister', v: 'villager' };

  it('offers the thief only roles nobody was dealt', () => {
    expect(getAvailableRolesForThief(roles)).toEqual([ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID]);
  });

  it('offers the thief nothing when every selectable role is taken', () => {
    const full = { ...roles, a: 'seer', b: 'witch', c: 'hunter', d: 'cupid' };
    expect(getAvailableRolesForThief(full)).toEqual([]);
  });

  it('counts the White Wolf as part of the pack', () => {
    expect(getWerewolves({ ...roles, ww: 'white_wolf' })).toEqual(['w1', 'w2', 'ww']);
  });

  it('finds werewolves, sisters and unique roles', () => {
    expect(getWerewolves(roles)).toEqual(['w1', 'w2']);
    expect(getSisters(roles)).toEqual(['s1', 's2']);
    expect(getPlayerWithRole(roles, ROLE.THIEF)).toBe('t');
    expect(getPlayerWithRole(roles, ROLE.SEER)).toBeNull();
  });

  it('finds a lover\'s partner', () => {
    expect(getLoversPartner('a', ['a', 'b'])).toBe('b');
    expect(getLoversPartner('c', ['a', 'b'])).toBeNull();
    expect(getLoversPartner('a', null)).toBeNull();
  });
});

describe('seating', () => {
  const table = (dead = []) => makeGame(
    { ana: 'villager', bo: 'villager', cy: 'villager', dan: 'villager', eve: 'villager' },
    { dead }
  ).players;
  const narrator = { id: 'nora', nickname: 'Nora', isAlive: true, isNarrator: true };

  it('seats everyone but the narrator, in join order', () => {
    expect(getSeating([narrator, ...table()]).map((p) => p.id)).toEqual(['ana', 'bo', 'cy', 'dan', 'eve']);
  });

  it('wraps around the table', () => {
    expect(getLivingNeighbours(table(), 'ana')).toEqual(['eve', 'bo']);
    expect(getLivingNeighbours(table(), 'eve')).toEqual(['dan', 'ana']);
  });

  it('skips eliminated players', () => {
    expect(getLivingNeighbours(table(['bo', 'eve']), 'ana')).toEqual(['dan', 'cy']);
  });

  it('never seats the narrator next to anyone', () => {
    expect(getLivingNeighbours([narrator, ...table()], 'ana')).toEqual(['eve', 'bo']);
    expect(getLivingNeighbours([narrator, ...table()], 'nora')).toEqual([]);
  });

  it('has the same neighbour on both sides with two players left', () => {
    expect(getLivingNeighbours(table(['bo', 'cy', 'dan']), 'ana')).toEqual(['eve', 'eve']);
  });

  it('has no neighbours when alone', () => {
    expect(getLivingNeighbours(table(['bo', 'cy', 'dan', 'eve']), 'ana')).toEqual([]);
  });
});

describe('rolesInPlay (the Notes role picker)', () => {
  it('lists only the dealt roles, plus Werewolf and Villager, in the usual order', () => {
    expect(rolesInPlay({ werewolf: 2, seer: 1, villager: 3 })).toEqual(['villager', 'werewolf', 'seer']);
    expect(rolesInPlay({ big_bad_wolf: 1, wild_child: 1, hunter: 1, werewolf: 1 }))
      .toEqual(['villager', 'werewolf', 'hunter', 'wild_child', 'big_bad_wolf']);
  });

  it('adds every role a Thief could steal', () => {
    expect(rolesInPlay({ werewolf: 1, thief: 1, seer: 1, villager: 2 }))
      .toEqual(['villager', 'werewolf', 'seer', 'witch', 'hunter', 'cupid', 'thief']);
  });

  it('falls back to every role without a recorded composition', () => {
    expect(rolesInPlay(undefined)).toHaveLength(Object.keys(ROLE_DEFINITIONS).length);
  });
});

describe('the Fox', () => {
  const ROLES = { ana: 'fox', bo: 'villager', cy: 'villager', dan: 'werewolf', eve: 'villager' };
  const table = (dead = []) => makeGame(ROLES, { dead }).players;

  it('sniffs the target and both living neighbours, in seating order', () => {
    expect(getFoxGroup(table(), 'cy')).toEqual(['bo', 'cy', 'dan']);
    expect(getFoxGroup(table(['dan']), 'cy')).toEqual(['bo', 'cy', 'eve']);
  });

  it('counts each player once when the table is small', () => {
    expect(getFoxGroup(table(['bo', 'cy', 'dan']), 'eve')).toEqual(['ana', 'eve']);
  });

  it('smells a wolf when one of the three is a wolf', () => {
    expect(foxSmellsWolf(table(), ROLES, 'cy')).toBe(true);
    expect(foxSmellsWolf(table(), ROLES, 'eve')).toBe(true);
    expect(foxSmellsWolf(table(), ROLES, 'ana')).toBe(false);
  });

  it('smells the White Wolf too', () => {
    expect(foxSmellsWolf(table(), { ...ROLES, dan: 'villager', bo: 'white_wolf' }, 'ana')).toBe(true);
  });
});
