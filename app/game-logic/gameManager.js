import { ROLE } from '../constants/roles';
import { assignRoles, checkWinCondition, getPlayerWithRole, getLoversPartner } from './roles';
import {
  updateRoom,
  eliminatePlayer,
  clearNightActions,
  addEvent,
} from '../firebase/roomService';

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
    lovers: null,
    hunterTriggered: null,
  });
}

// Eliminates a player and their lover if applicable. Returns list of all eliminated IDs.
async function eliminateWithLoverChain(roomId, playerId, players, lovers, events, label) {
  const eliminated = [playerId];
  await eliminatePlayer(roomId, playerId);

  const partner = getLoversPartner(playerId, lovers);
  const partnerPlayer = partner ? players.find((p) => p.id === partner && p.isAlive) : null;
  if (partnerPlayer) {
    eliminated.push(partner);
    await eliminatePlayer(roomId, partner);
    events.push(`${partnerPlayer.nickname} died of heartbreak after losing their lover.`);
  }

  return eliminated;
}

export async function resolveNight(roomId, roomData) {
  const { nightActions, players, roles, phase, witchPotions, lovers } = roomData;

  let eliminatedId = nightActions.werewolf || null;
  const witchSaved = nightActions.witchSave === eliminatedId;
  const witchKilled = nightActions.witchPoison || null;
  const newLovers = nightActions.cupid || lovers || null;
  const events = [];

  if (witchSaved && eliminatedId) {
    events.push(`Night ${phase}: The witch saved the werewolves' victim.`);
    eliminatedId = null;
  }

  const allEliminated = new Set();

  if (eliminatedId) {
    const victim = players.find((p) => p.id === eliminatedId);
    events.push(`Night ${phase}: ${victim?.nickname || 'Someone'} was eliminated by the werewolves.`);
    const ids = await eliminateWithLoverChain(roomId, eliminatedId, players, newLovers, events, `Night ${phase}`);
    ids.forEach((id) => allEliminated.add(id));
  } else if (!witchSaved) {
    events.push(`Night ${phase}: The village was peaceful — no one was eliminated.`);
  }

  if (witchKilled && !allEliminated.has(witchKilled)) {
    const poisoned = players.find((p) => p.id === witchKilled);
    events.push(`Night ${phase}: ${poisoned?.nickname || 'Someone'} was poisoned by the witch.`);
    const ids = await eliminateWithLoverChain(roomId, witchKilled, players, newLovers, events, `Night ${phase}`);
    ids.forEach((id) => allEliminated.add(id));
  }

  const updatedPotions = { ...witchPotions };
  if (witchSaved) {
    const witchId = getPlayerWithRole(roles, ROLE.WITCH);
    if (witchId) updatedPotions[witchId] = { ...updatedPotions[witchId], save: false };
  }
  if (witchKilled) {
    const witchId = getPlayerWithRole(roles, ROLE.WITCH);
    if (witchId) updatedPotions[witchId] = { ...updatedPotions[witchId], poison: false };
  }

  const updatedPlayers = players.map((p) =>
    allEliminated.has(p.id) ? { ...p, isAlive: false } : p
  );

  const winner = checkWinCondition(updatedPlayers, roles, newLovers);
  for (const e of events) await addEvent(roomId, e);

  const hunterTriggered = [...allEliminated].find((id) => roles[id] === ROLE.HUNTER) || null;

  await updateRoom(roomId, {
    status: winner ? 'ended' : 'day',
    winner: winner || null,
    eliminatedThisNight: eliminatedId,
    witchPotions: updatedPotions,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    lovers: newLovers,
    hunterTriggered: hunterTriggered || null,
  });

  return { winner, eliminatedId };
}

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

export async function resolveLynch(roomId, roomData, accusedId) {
  const { votes, players, roles, phase, lovers } = roomData;
  const voteValues = Object.values(votes);
  const lynchCount = voteValues.filter((v) => v === 'lynch').length;
  const spareCount = voteValues.filter((v) => v === 'spare').length;
  const events = [];

  events.push(`Day ${phase}: Vote results — ${lynchCount} lynch, ${spareCount} spare.`);

  const allEliminated = new Set();
  let eliminatedId = null;

  if (lynchCount > spareCount) {
    eliminatedId = accusedId;
    const victim = players.find((p) => p.id === accusedId);
    events.push(`Day ${phase}: ${victim?.nickname || 'Someone'} was lynched. (Role: ${roles[accusedId] || '?'})`);
    const ids = await eliminateWithLoverChain(roomId, accusedId, players, lovers, events, `Day ${phase}`);
    ids.forEach((id) => allEliminated.add(id));
  } else {
    events.push(`Day ${phase}: ${players.find((p) => p.id === accusedId)?.nickname || 'Someone'} was spared.`);
  }

  const updatedPlayers = players.map((p) =>
    allEliminated.has(p.id) ? { ...p, isAlive: false } : p
  );

  const winner = checkWinCondition(updatedPlayers, roles, lovers);
  for (const e of events) await addEvent(roomId, e);

  const hunterTriggered = [...allEliminated].find((id) => roles[id] === ROLE.HUNTER) || null;

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

export async function hunterShoot(roomId, roomData, targetId) {
  const { players, roles, lovers } = roomData;
  const events = [];
  const target = players.find((p) => p.id === targetId);
  events.push(`The Hunter's last shot took down ${target?.nickname || 'someone'}.`);

  const allEliminated = new Set();
  const ids = await eliminateWithLoverChain(roomId, targetId, players, lovers, events, '');
  ids.forEach((id) => allEliminated.add(id));

  for (const e of events) await addEvent(roomId, e);

  const updatedPlayers = players.map((p) =>
    allEliminated.has(p.id) ? { ...p, isAlive: false } : p
  );
  const winner = checkWinCondition(updatedPlayers, roles, lovers);

  await updateRoom(roomId, {
    winner: winner || null,
    status: winner ? 'ended' : roomData.status,
    hunterTriggered: null,
  });
}
