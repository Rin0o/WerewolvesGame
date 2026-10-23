import { deriveGameState } from '../useGameState';
import { relatedGroups } from '../../utils/relatedGroups';
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
