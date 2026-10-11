export const ROOM_ID = 'room-1';

export function makeGame(roleByPlayer, { dead = [], phase = 2, ...overrides } = {}) {
  const ids = Object.keys(roleByPlayer);
  return {
    status: 'night',
    phase,
    players: ids.map((id) => ({
      id,
      nickname: id[0].toUpperCase() + id.slice(1),
      isAlive: !dead.includes(id),
      isHost: false,
      isReady: true,
    })),
    roles: { ...roleByPlayer },
    nightActions: {},
    witchPotions: {},
    lovers: null,
    disconnectedPlayers: [],
    votes: {},
    winner: null,
    hunterTriggered: null,
    ...overrides,
  };
}

export function votesFor(targetByVoter) {
  return Object.fromEntries(
    Object.entries(targetByVoter).map(([voter, target]) => [voter, { target, confirmed: true }])
  );
}

export function lastUpdate(updateRoom) {
  const { calls } = updateRoom.mock;
  return calls[calls.length - 1][1];
}

export function eventsOf(update) {
  return update.events.arrayUnion;
}

export function countRoles(roles) {
  return roles.reduce((acc, role) => ({ ...acc, [role]: (acc[role] || 0) + 1 }), {});
}
