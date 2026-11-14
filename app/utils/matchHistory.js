export const MODE_LABELS = {
  normal: 'Normal',
  custom: 'Custom',
  narrator: 'Narrator',
};

export const WINNER_LABELS = {
  villagers: 'The village won',
  werewolves: 'The werewolves won',
  lovers: 'The lovers won',
  white_wolf: 'The White Wolf won',
};

export function myEntry(game, uid) {
  return game.players?.find((p) => p.id === uid) ?? null;
}

export function myOutcome(game, uid) {
  if (game.narratorId === uid || myEntry(game, uid)?.isNarrator) return 'narrator';
  return game.winnerIds?.includes(uid) ? 'won' : 'lost';
}

export function winRate({ played = 0, won = 0, narrated = 0 }) {
  const asPlayer = played - narrated;
  if (asPlayer <= 0) return null;
  return Math.round((won / asPlayer) * 100);
}

export function roleRecord(games, uid) {
  const byRole = {};
  games.forEach((game) => {
    const outcome = myOutcome(game, uid);
    const role = myEntry(game, uid)?.role;
    if (outcome === 'narrator' || !role) return;
    const entry = byRole[role] || (byRole[role] = { role, played: 0, won: 0 });
    entry.played += 1;
    if (outcome === 'won') entry.won += 1;
  });
  return Object.values(byRole).sort((a, b) => b.played - a.played || b.won - a.won || a.role.localeCompare(b.role));
}

export function gameDate(game) {
  const endedAt = game.endedAt;
  if (endedAt?.toDate) return endedAt.toDate();
  if (typeof game.gameStartedAt === 'number') return new Date(game.gameStartedAt);
  return null;
}
