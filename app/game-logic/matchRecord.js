import { ROLE, ROLE_DEFINITIONS, isPackWolf } from '../constants/roles';

export function didWin(room, playerId) {
  const player = room.players?.find((p) => p.id === playerId);
  if (!player || player.isNarrator) return false;
  const role = room.roles?.[playerId];
  const teamRole = playerId === room.infectedId ? ROLE.WEREWOLF : role;
  switch (room.winner) {
    case 'villagers':
      return (ROLE_DEFINITIONS[teamRole] || ROLE_DEFINITIONS.villager).team === 'villagers';
    case 'werewolves':
      return isPackWolf(teamRole);
    case 'white_wolf':
      return role === ROLE.WHITE_WOLF;
    case 'lovers':
      return !!room.lovers?.includes(playerId);
    default:
      return false;
  }
}

export function winnersOf(room) {
  return (room.players || []).filter((p) => didWin(room, p.id)).map((p) => p.id);
}

export function canRecordMatch(room) {
  return room?.status === 'ended' && !!room.winner && typeof room.gameStartedAt === 'number';
}

export function matchRecordId(roomId, gameStartedAt) {
  return `${roomId}_${gameStartedAt}`;
}

export function matchToRecord(roomId, room, playerId, lastSavedId) {
  if (!room || room.hostId !== playerId || !canRecordMatch(room)) return null;
  const id = matchRecordId(roomId, room.gameStartedAt);
  return id === lastSavedId ? null : id;
}

export function buildMatchRecord(roomId, room) {
  const players = room.players || [];
  const roles = room.roles || {};
  const winners = new Set(winnersOf(room));
  const realPlayers = players.filter((p) => !p.isBot);
  return {
    roomId,
    code: room.code ?? null,
    gameStartedAt: room.gameStartedAt,
    gameMode: room.gameMode || 'normal',
    classicFirstNight: !!room.classicFirstNight,
    tieRule: room.tieRule || 'no_lynch',
    rounds: room.phase || 0,
    winner: room.winner,
    roleComposition: room.roleComposition || {},
    withBots: players.some((p) => p.isBot),
    narratorId: players.find((p) => p.isNarrator)?.id ?? null,
    playerIds: realPlayers.map((p) => p.id),
    winnerIds: realPlayers.filter((p) => winners.has(p.id)).map((p) => p.id),
    players: players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      role: roles[p.id] ?? null,
      infected: p.id === room.infectedId,
      won: winners.has(p.id),
      alive: p.isAlive !== false,
      isBot: !!p.isBot,
      isNarrator: !!p.isNarrator,
    })),
    events: room.events || [],
    history: room.history || [],
  };
}
