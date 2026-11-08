import { useMemo } from 'react';
import { ROLE, isWolfRole, teamRoles } from '../constants/roles';
import { getWerewolves, getLoversPartner, getAvailableRolesForThief, getSisters } from '../game-logic/roles';

export function deriveGameState(room, currentPlayerId) {
  if (!room) return {};

  const { players = [], roles = {}, lovers = null } = room;

  const myRole = roles[currentPlayerId];
  const myPlayer = players.find((p) => p.id === currentPlayerId);
  const isAlive = myPlayer?.isAlive ?? false;
  const isHost = myPlayer?.isHost ?? false;
  const isNarrator = myPlayer?.isNarrator ?? false;

  const team = teamRoles(roles, room.infectedId);
  const isWolf = isWolfRole(team[currentPlayerId]);
  const fellowWolves = isWolf
    ? getWerewolves(team).filter((id) => id !== currentPlayerId)
    : [];
  const fellowSisters = myRole === ROLE.SISTER
    ? getSisters(roles).filter((id) => id !== currentPlayerId)
    : [];

  const myLoverId = getLoversPartner(currentPlayerId, lovers);
  const myLover = myLoverId ? players.find((p) => p.id === myLoverId) : null;

  const availableThiefRoles = myRole === ROLE.THIEF ? getAvailableRolesForThief(roles) : [];

  return {
    myRole,
    isWolf,
    isInfected: !!room.infectedId && room.infectedId === currentPlayerId,
    isAlive,
    isHost,
    isNarrator,
    fellowWolves,
    fellowSisters,
    myLover,
    isLover: !!myLoverId,
    availableThiefRoles,
  };
}

export default function useGameState(room, currentPlayerId) {
  return useMemo(() => deriveGameState(room, currentPlayerId), [room, currentPlayerId]);
}
