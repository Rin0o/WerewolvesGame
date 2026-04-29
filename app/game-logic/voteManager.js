/**
 * Returns true when all alive players have submitted a vote.
 */
export function allVotesIn(votes, players, disconnectedPlayers = []) {
  const aliveIds = players
    .filter((p) => p.isAlive && !disconnectedPlayers.includes(p.id))
    .map((p) => p.id);
  return aliveIds.length > 0 && aliveIds.every((id) => votes[id] !== undefined);
}

/**
 * Tallies votes, returns { lynch, spare, winner: 'lynch'|'spare'|'tie' }
 */
export function tallyVotes(votes) {
  const values = Object.values(votes);
  const lynch = values.filter((v) => v === 'lynch').length;
  const spare = values.filter((v) => v === 'spare').length;
  return {
    lynch,
    spare,
    winner: lynch > spare ? 'lynch' : spare > lynch ? 'spare' : 'tie',
  };
}
