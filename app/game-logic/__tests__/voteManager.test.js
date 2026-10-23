import { allVotesIn, tallyVotes } from '../voteManager';
import { makeGame, votesFor } from './helpers';

describe('tallyVotes', () => {
  it('lynches the single player with the most votes', () => {
    const result = tallyVotes(votesFor({ a: 'x', b: 'x', c: 'y' }));
    expect(result).toEqual({ tallyMap: { x: 2, y: 1 }, eliminatedId: 'x', tie: false, tied: [] });
  });

  it('lynches nobody on a tie and lists the tied players', () => {
    const result = tallyVotes(votesFor({ a: 'x', b: 'y', c: 'x', d: 'y', e: 'z' }));
    expect(result.eliminatedId).toBeNull();
    expect(result.tie).toBe(true);
    expect(result.tied.sort()).toEqual(['x', 'y']);
  });

  it('lynches nobody when there are no votes', () => {
    expect(tallyVotes({})).toEqual({ tallyMap: {}, eliminatedId: null, tie: false, tied: [] });
  });

  it('ignores unconfirmed votes', () => {
    const votes = { ...votesFor({ a: 'x' }), b: { target: 'y', confirmed: false }, c: { target: 'y' } };
    expect(tallyVotes(votes)).toEqual({ tallyMap: { x: 1 }, eliminatedId: 'x', tie: false, tied: [] });
  });
});

describe('allVotesIn', () => {
  const game = makeGame({ a: 'werewolf', b: 'villager', c: 'villager', d: 'villager' }, { dead: ['d'] });

  it('is true once every living player has a confirmed vote', () => {
    expect(allVotesIn(votesFor({ a: 'b', b: 'a', c: 'a' }), game.players)).toBe(true);
  });

  it('is false while a living player has not voted', () => {
    expect(allVotesIn(votesFor({ a: 'b', b: 'a' }), game.players)).toBe(false);
  });

  it('does not count an unconfirmed vote', () => {
    const votes = { ...votesFor({ a: 'b', b: 'a' }), c: { target: 'a', confirmed: false } };
    expect(allVotesIn(votes, game.players)).toBe(false);
  });

  it('does not wait for disconnected players or the narrator', () => {
    const players = [...game.players, { id: 'n', nickname: 'N', isAlive: true, isNarrator: true }];
    expect(allVotesIn(votesFor({ a: 'b', b: 'a' }), players, ['c'])).toBe(true);
  });

  it('is false when nobody can vote', () => {
    expect(allVotesIn({}, [])).toBe(false);
  });
});
