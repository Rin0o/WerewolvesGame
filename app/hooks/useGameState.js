import { useMemo } from 'react';
import { ROLE } from '../constants/roles';
import { checkWinCondition, getWerewolves, getPlayerWithRole } from '../game-logic/roles';

/**
 * Derives computed game state from raw room data and current player id.
 * All heavy selectors live here so screens stay lean.
 */
export default function useGameState(room, currentPlayerId) {
  return useMemo(() => {
    if (!room) return {};

    const { players = [], roles = {}, status, phase, votes = {}, nightActions = {} } = room;

    const myRole = roles[currentPlayerId];
    const myPlayer = players.find((p) => p.id === currentPlayerId);
    const isAlive = myPlayer?.isAlive ?? false;
    const isHost = myPlayer?.isHost ?? false;
    const isSpectator = !isAlive;

    const alivePlayers = players.filter((p) => p.isAlive);
    const deadPlayers = players.filter((p) => !p.isAlive);

    const werewolfIds = getWerewolves(roles);
    const isWerewolf = myRole === ROLE.WEREWOLF;
    const fellowWolves = isWerewolf
      ? werewolfIds.filter((id) => id !== currentPlayerId)
      : [];

    const seerId = getPlayerWithRole(roles, ROLE.SEER);
    const witchId = getPlayerWithRole(roles, ROLE.WITCH);
    const hunterId = getPlayerWithRole(roles, ROLE.HUNTER);

    const isNight = status === 'night';
    const isDay = status === 'day';
    const isEnded = status === 'ended';
    const isLobby = status === 'lobby';

    const winner = room.winner || checkWinCondition(players, roles);

    // Night action readiness
    const werewolvesActed = !!nightActions.werewolf;
    const seerActed = !!nightActions.seer;
    const witchActed = nightActions.witchSave !== undefined || nightActions.witchPoison !== undefined || nightActions.witchSkip;

    const myVote = votes[currentPlayerId];
    const voteCount = Object.keys(votes).length;
    const aliveCount = alivePlayers.length;

    return {
      myRole,
      myPlayer,
      isAlive,
      isHost,
      isSpectator,
      isWerewolf,
      fellowWolves,
      seerId,
      witchId,
      hunterId,
      alivePlayers,
      deadPlayers,
      isNight,
      isDay,
      isEnded,
      isLobby,
      winner,
      werewolvesActed,
      seerActed,
      witchActed,
      myVote,
      voteCount,
      aliveCount,
      werewolfIds,
    };
  }, [room, currentPlayerId]);
}
