import { ROLE } from '../constants/roles';
import { assignRoles, checkWinCondition, getPlayerWithRole } from './roles';
import {
  updateRoom,
  eliminatePlayer,
  clearNightActions,
  clearVotes,
  addEvent,
} from '../firebase/roomService';

/**
 * Starts the game: assigns roles, sets status to 'night', phase 1.
 */
export async function startGame(roomId, players) {
  const { roleMap, witchPotions } = assignRoles(players);

  await updateRoom(roomId, {
    roles: roleMap,
    witchPotions,
    status: 'night',
    phase: 1,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    eliminatedThisNight: null,
    events: [`Game started with ${players.length} players.`],
    winner: null,
    votes: {},
    accusedPlayerId: null,
  });
}

/**
 * Resolves all night actions and transitions to day phase.
 * Called by host client after all actions are submitted or timer expires.
 *
 * Night resolution order:
 *  1. Werewolves pick a victim
 *  2. Witch can save or kill
 *  3. Seer reveal (informational only, no state change)
 */
export async function resolveNight(roomId, roomData) {
  const { nightActions, players, roles, phase, witchPotions } = roomData;

  let eliminatedId = nightActions.werewolf || null;
  const witchSaved = nightActions.witchSave === eliminatedId;
  const witchKilled = nightActions.witchPoison || null;
  const events = [];

  // Witch save
  if (witchSaved && eliminatedId) {
    events.push(`Night ${phase}: The witch saved the werewolves' victim.`);
    eliminatedId = null;
  }

  // Apply werewolf kill
  if (eliminatedId) {
    await eliminatePlayer(roomId, eliminatedId);
    const victim = players.find((p) => p.id === eliminatedId);
    events.push(`Night ${phase}: ${victim?.nickname || 'Someone'} was eliminated by the werewolves.`);
  } else if (!witchSaved) {
    events.push(`Night ${phase}: The village was peaceful — no one was eliminated.`);
  }

  // Witch poison kill
  if (witchKilled) {
    await eliminatePlayer(roomId, witchKilled);
    const poisoned = players.find((p) => p.id === witchKilled);
    events.push(`Night ${phase}: ${poisoned?.nickname || 'Someone'} was poisoned by the witch.`);
  }

  // Update witch potions
  const updatedPotions = { ...witchPotions };
  if (witchSaved) {
    const witchId = getPlayerWithRole(roles, ROLE.WITCH);
    if (witchId) updatedPotions[witchId] = { ...updatedPotions[witchId], save: false };
  }
  if (witchKilled) {
    const witchId = getPlayerWithRole(roles, ROLE.WITCH);
    if (witchId) updatedPotions[witchId] = { ...updatedPotions[witchId], poison: false };
  }

  // Fetch fresh player list to check win
  const updatedPlayers = players.map((p) => {
    if (p.id === eliminatedId || p.id === witchKilled) return { ...p, isAlive: false };
    return p;
  });

  const winner = checkWinCondition(updatedPlayers, roles);

  for (const e of events) await addEvent(roomId, e);

  await updateRoom(roomId, {
    status: winner ? 'ended' : 'day',
    winner: winner || null,
    eliminatedThisNight: eliminatedId,
    witchPotions: updatedPotions,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
  });

  // Handle Hunter death during night
  if (eliminatedId && roles[eliminatedId] === ROLE.HUNTER) {
    await updateRoom(roomId, { hunterTriggered: eliminatedId });
  }
  if (witchKilled && roles[witchKilled] === ROLE.HUNTER) {
    await updateRoom(roomId, { hunterTriggered: witchKilled });
  }

  return { winner, eliminatedId, witchKilled };
}

/**
 * Advances from day to next night phase.
 */
export async function startNextNight(roomId, currentPhase) {
  await clearNightActions(roomId);
  await updateRoom(roomId, {
    status: 'night',
    phase: currentPhase + 1,
    phaseStartedAt: new Date().toISOString(),
    eliminatedThisNight: null,
    accusedPlayerId: null,
    votes: {},
    hunterTriggered: null,
  });
}

/**
 * Resolves a lynch vote. Returns the eliminated player id or null (spare).
 */
export async function resolveLynch(roomId, roomData, accusedId) {
  const { votes, players, roles, phase } = roomData;
  const voteValues = Object.values(votes);
  const lynchCount = voteValues.filter((v) => v === 'lynch').length;
  const spareCount = voteValues.filter((v) => v === 'spare').length;
  const events = [];

  events.push(`Day ${phase}: Vote results — ${lynchCount} lynch, ${spareCount} spare.`);

  let eliminatedId = null;

  if (lynchCount > spareCount) {
    eliminatedId = accusedId;
    await eliminatePlayer(roomId, accusedId);
    const victim = players.find((p) => p.id === accusedId);
    events.push(`Day ${phase}: ${victim?.nickname || 'Someone'} was lynched. (Role: ${roles[accusedId] || '?'})`);
  } else {
    events.push(`Day ${phase}: ${players.find((p) => p.id === accusedId)?.nickname || 'Someone'} was spared.`);
  }

  const updatedPlayers = players.map((p) =>
    p.id === eliminatedId ? { ...p, isAlive: false } : p
  );

  const winner = checkWinCondition(updatedPlayers, roles);
  for (const e of events) await addEvent(roomId, e);

  let hunterTriggered = null;
  if (eliminatedId && roles[eliminatedId] === ROLE.HUNTER) {
    hunterTriggered = eliminatedId;
  }

  await updateRoom(roomId, {
    winner: winner || null,
    status: winner ? 'ended' : 'day',
    hunterTriggered,
    votes: {},
    accusedPlayerId: null,
    phaseStartedAt: new Date().toISOString(),
  });

  return { eliminatedId, winner };
}

/**
 * Hunter fires their final shot — eliminates another player.
 */
export async function hunterShoot(roomId, roomData, targetId) {
  const { players, roles, phase } = roomData;
  await eliminatePlayer(roomId, targetId);
  const target = players.find((p) => p.id === targetId);
  await addEvent(roomId, `The Hunter's last shot took down ${target?.nickname || 'someone'}.`);

  const updatedPlayers = players.map((p) =>
    p.id === targetId ? { ...p, isAlive: false } : p
  );
  const winner = checkWinCondition(updatedPlayers, roles);

  await updateRoom(roomId, {
    winner: winner || null,
    status: winner ? 'ended' : roomData.status,
    hunterTriggered: null,
  });
}
