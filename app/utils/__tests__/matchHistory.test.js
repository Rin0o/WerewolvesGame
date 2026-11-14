import { myOutcome, winRate, roleRecord, gameDate } from '../matchHistory';

function game(role, { won = false, narrator = false } = {}) {
  return {
    narratorId: narrator ? 'me' : null,
    winnerIds: won ? ['me'] : [],
    players: [{ id: 'me', role: narrator ? null : role, isNarrator: narrator }],
  };
}

describe('myOutcome', () => {
  it('reads won, lost or narrator', () => {
    expect(myOutcome(game('seer', { won: true }), 'me')).toBe('won');
    expect(myOutcome(game('seer'), 'me')).toBe('lost');
    expect(myOutcome(game(null, { narrator: true }), 'me')).toBe('narrator');
  });

  it('a deleted account no longer wins', () => {
    expect(myOutcome({ ...game('seer', { won: true }), winnerIds: [] }, 'me')).toBe('lost');
  });
});

describe('winRate', () => {
  it('leaves narrated games out', () => {
    expect(winRate({ played: 10, won: 3, narrated: 4 })).toBe(50);
  });

  it('is null without a game played as a player', () => {
    expect(winRate({ played: 2, won: 0, narrated: 2 })).toBeNull();
    expect(winRate({})).toBeNull();
  });
});

describe('roleRecord', () => {
  it('counts games and wins per role, most played first, narrated games left out', () => {
    const games = [
      game('seer', { won: true }),
      game('werewolf'),
      game('werewolf', { won: true }),
      game(null, { narrator: true }),
      game('villager'),
    ];
    expect(roleRecord(games, 'me')).toEqual([
      { role: 'werewolf', played: 2, won: 1 },
      { role: 'seer', played: 1, won: 1 },
      { role: 'villager', played: 1, won: 0 },
    ]);
  });
});

describe('gameDate', () => {
  it('uses the end time, or the start time while the save is pending', () => {
    const end = new Date(2026, 10, 14);
    expect(gameDate({ endedAt: { toDate: () => end } })).toBe(end);
    expect(gameDate({ endedAt: null, gameStartedAt: 5 })).toEqual(new Date(5));
    expect(gameDate({})).toBeNull();
  });
});
