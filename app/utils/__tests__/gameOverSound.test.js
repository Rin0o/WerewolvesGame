import { gameOverSound } from '../gameOverSound';

describe('gameOverSound', () => {
  it('plays the village fanfare when the village or the lovers win', () => {
    expect(gameOverSound({ status: 'ended', winner: 'villagers' })).toBe('villagersWin');
    expect(gameOverSound({ status: 'ended', winner: 'lovers' })).toBe('villagersWin');
  });

  it('plays the wolves\' sound only when a wolf side wins', () => {
    expect(gameOverSound({ status: 'ended', winner: 'werewolves' })).toBe('wolvesWin');
    expect(gameOverSound({ status: 'ended', winner: 'white_wolf' })).toBe('wolvesWin');
  });

  it('stays silent while Play Again resets the room', () => {
    expect(gameOverSound({ status: 'lobby', winner: null })).toBeNull();
  });

  it('stays silent without a known winner', () => {
    expect(gameOverSound(null)).toBeNull();
    expect(gameOverSound({ status: 'ended', winner: null })).toBeNull();
  });
});
