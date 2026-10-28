import { deriveGameState } from '../useGameState';
import { relatedGroups } from '../../utils/relatedGroups';
import { wildChildNotice, infectedNotice } from '../useTurnedWolfNotice';
import { makeGame } from '../../game-logic/__tests__/helpers';

const TABLE = {
  will: 'werewolf',
  walt: 'white_wolf',
  sara: 'sister',
  suzy: 'sister',
  cora: 'cupid',
  vic: 'villager',
  vera: 'villager',
};

function groupsFor(playerId, overrides = {}) {
  const room = makeGame(TABLE, overrides);
  return Object.fromEntries(
    relatedGroups(deriveGameState(room, playerId), room).map((g) => [g.label, g.names])
  );
}

describe('what a player learns about others (eye pop-up)', () => {
  it('a werewolf sees the rest of the pack, White Wolf included', () => {
    expect(groupsFor('will')['Your pack']).toEqual(['Walt']);
    expect(groupsFor('walt')['Your pack']).toEqual(['Will']);
  });

  it('a sister sees only the other sister', () => {
    const groups = groupsFor('sara');
    expect(groups['Your sister']).toEqual(['Suzy']);
    expect(groups['Your pack']).toEqual([]);
  });

  it('a villager learns nothing about anyone', () => {
    const groups = groupsFor('vic');
    Object.values(groups).forEach((names) => expect(names).toEqual([]));
  });

  it('a lover sees their partner, and only Cupid sees both lovers', () => {
    const lovers = { lovers: ['vic', 'will'] };
    expect(groupsFor('vic', lovers)['Your lover']).toEqual(['Will']);
    expect(groupsFor('vera', lovers)['Your lover']).toEqual([]);
    expect(groupsFor('cora', lovers)['The lovers you bound']).toEqual(['Vic', 'Will']);
    expect(groupsFor('vera', lovers)['The lovers you bound']).toBeUndefined();
  });

  it('marks related players who have died', () => {
    expect(groupsFor('will', { dead: ['walt'] })['Your pack']).toEqual(['Walt (dead)']);
  });

  it('only the Wild Child sees its role model', () => {
    const room = makeGame({ ...TABLE, kid: 'wild_child' }, { wildChildId: 'kid', wildChildModel: 'vera' });
    const groups = (id) => Object.fromEntries(relatedGroups(deriveGameState(room, id), room).map((g) => [g.label, g.names]));
    expect(groups('kid')['Your role model']).toEqual(['Vera']);
    expect(groups('vera')['Your role model']).toBeUndefined();
  });
});

describe('an infected player', () => {
  const ROLES = { will: 'werewolf', wfa: 'wolf_father', wendy: 'witch', vic: 'villager', sam: 'seer' };
  const infected = (overrides = {}) => makeGame(ROLES, {
    code: 'ABCDE', infectedId: 'wendy', infectedAt: '2026-10-28T21:00:00.000Z',
    witchPotions: { wendy: { save: false, poison: true } }, ...overrides,
  });

  it('keeps their real role but joins the pack, and the pack sees them', () => {
    const room = infected();
    expect(deriveGameState(room, 'wendy')).toMatchObject({ myRole: 'witch', isWolf: true, isInfected: true });
    expect(deriveGameState(room, 'wendy').fellowWolves.sort()).toEqual(['wfa', 'will']);
    expect(deriveGameState(room, 'will').fellowWolves.sort()).toEqual(['wendy', 'wfa']);
    expect(deriveGameState(room, 'vic')).toMatchObject({ isWolf: false, fellowWolves: [] });
  });

  it('is told privately, and an infected Witch learns exactly which potions she still has', () => {
    const notice = infectedNotice(infected(), 'wendy');
    expect(notice).toMatchObject({ fromRole: 'witch', title: 'You have been infected', pack: ['Will', 'Wfa'] });
    expect(notice.changes[0]).toBe('You are still the Witch, with your potions exactly as they were. You still have the poison potion.');
    expect(infectedNotice(infected(), 'vic')).toBeNull();
  });

  it('keeps any other role\'s power', () => {
    const notice = infectedNotice(infected({ infectedId: 'sam' }), 'sam');
    expect(notice.changes[0]).toBe('You are still the Seer, and keep its power.');
  });
});

describe('the Wild Child\'s notice', () => {
  const turned = (overrides = {}) => makeGame(
    { will: 'werewolf', walt: 'white_wolf', kid: 'werewolf', vic: 'villager' },
    { code: 'ABCDE', wildChildId: 'kid', wildChildModel: 'vic', wildChildTurnedAt: '2026-10-28T20:00:00.000Z', dead: ['vic'], ...overrides }
  );

  it('tells the turned Wild Child who died and who its pack is', () => {
    const notice = wildChildNotice(turned(), 'kid');
    expect(notice).toMatchObject({ key: 'ABCDE:kid:2026-10-28T20:00:00.000Z', fromRole: 'wild_child', pack: ['Will', 'Walt'] });
    expect(notice.cause).toMatch(/Vic, is dead/);
  });

  it('leaves dead wolves out of the pack', () => {
    expect(wildChildNotice(turned({ dead: ['vic', 'walt'] }), 'kid').pack).toEqual(['Will']);
  });

  it('is shown to nobody else, and not before the Wild Child turns', () => {
    expect(wildChildNotice(turned(), 'will')).toBeNull();
    expect(wildChildNotice(turned({ wildChildTurnedAt: null }), 'kid')).toBeNull();
    expect(wildChildNotice(turned({ roles: { kid: 'wild_child' } }), 'kid')).toBeNull();
  });
});

describe('deriveGameState', () => {
  it('reads my own role, life and host status', () => {
    const room = makeGame(TABLE, { dead: ['vic'] });
    room.players[0].isHost = true;
    expect(deriveGameState(room, 'will')).toMatchObject({ myRole: 'werewolf', isAlive: true, isHost: true });
    expect(deriveGameState(room, 'vic')).toMatchObject({ myRole: 'villager', isAlive: false, isHost: false });
  });

  it('never gives a non-wolf the list of wolves', () => {
    const room = makeGame(TABLE);
    ['sara', 'cora', 'vic'].forEach((id) => expect(deriveGameState(room, id).fellowWolves).toEqual([]));
  });

  it('only the Thief gets the roles they could steal', () => {
    const room = makeGame({ ...TABLE, tom: 'thief' });
    expect(deriveGameState(room, 'tom').availableThiefRoles.length).toBeGreaterThan(0);
    expect(deriveGameState(room, 'vic').availableThiefRoles).toEqual([]);
  });

  it('marks the narrator', () => {
    const room = makeGame(TABLE);
    room.players.push({ id: 'nora', nickname: 'Nora', isAlive: true, isNarrator: true });
    expect(deriveGameState(room, 'nora')).toMatchObject({ isNarrator: true, myRole: undefined });
  });

  it('is empty before the room loads', () => {
    expect(deriveGameState(null, 'vic')).toEqual({});
  });
});
