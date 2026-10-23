export function allVotesIn(votes, players, disconnectedPlayers = []) {
  const aliveIds = players
    .filter((p) => p.isAlive && !p.isNarrator && !disconnectedPlayers.includes(p.id))
    .map((p) => p.id);
  return aliveIds.length > 0 && aliveIds.every((id) => votes[id]?.confirmed === true);
}

export function tallyVotes(votes) {
  const confirmed = Object.entries(votes).filter(([, v]) => v?.confirmed);
  const tallyMap = {};
  for (const [, v] of confirmed) {
    tallyMap[v.target] = (tallyMap[v.target] || 0) + 1;
  }
  if (Object.keys(tallyMap).length === 0) {
    return { tallyMap, eliminatedId: null, tie: false, tied: [] };
  }
  const maxVotes = Math.max(...Object.values(tallyMap));
  const top = Object.entries(tallyMap).filter(([, c]) => c === maxVotes).map(([id]) => id);
  return {
    tallyMap,
    eliminatedId: top.length === 1 ? top[0] : null,
    tie: top.length > 1,
    tied: top.length > 1 ? top : [],
  };
}
