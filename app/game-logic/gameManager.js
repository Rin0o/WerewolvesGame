import { arrayUnion } from 'firebase/firestore';
import { ROLE, getCompositionForCount } from '../constants/roles';
import { assignRoles, checkWinCondition, getPlayerWithRole, getLoversPartner, getAvailableRolesForThief } from './roles';
import {
  updateRoom,
  eliminatePlayer,
  clearNightActions,
} from '../firebase/roomService';
import { BOT_CONFIG } from '../constants/devConfig';

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function startGame(roomId, players, customComposition = null) {
  const humanPlayers = players.filter((p) => !p.isBot);
  let allPlayers = humanPlayers;
  let roleMap = {};
  let witchPotions = {};

  if (BOT_CONFIG.enabled && BOT_CONFIG.bots.length > 0) {
    const botPlayers = BOT_CONFIG.bots.map((b, i) => ({
      id: `bot-${i}`,
      nickname: b.nickname,
      isAlive: true,
      isHost: false,
      isReady: true,
      isBot: true,
    }));
    allPlayers = [...humanPlayers, ...botPlayers];

    const composition = customComposition || getCompositionForCount(allPlayers.length);
    const remaining = [...composition];
    for (const role of BOT_CONFIG.bots.map((b) => b.role)) {
      const idx = remaining.indexOf(role);
      if (idx !== -1) remaining.splice(idx, 1);
    }
    const humanRoles = shuffleArr(remaining).slice(0, humanPlayers.length);
    shuffleArr(humanPlayers).forEach((p, i) => {
      const role = humanRoles[i] || ROLE.VILLAGER;
      roleMap[p.id] = role;
      if (role === ROLE.WITCH) witchPotions[p.id] = { save: true, poison: true };
    });
    botPlayers.forEach((bot, i) => {
      roleMap[bot.id] = BOT_CONFIG.bots[i].role;
    });
  } else {
    const result = assignRoles(humanPlayers, customComposition);
    roleMap = result.roleMap;
    witchPotions = result.witchPotions;
  }

  await updateRoom(roomId, {
    roles: roleMap,
    witchPotions,
    players: allPlayers,
    status: 'night',
    phase: 1,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    eliminatedThisNight: null,
    events: [`Game started with ${allPlayers.length} players.`],
    winner: null,
    votes: {},
    accusedPlayerId: null,
    lovers: null,
    hunterTriggered: null,
    disconnectedPlayers: [],
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
  const { nightActions, players, roles, phase, witchPotions, lovers, disconnectedPlayers = [] } = roomData;

  const events = [];

  let updatedRoles = { ...roles };
  if (nightActions.thief) {
    const thiefPlayerId = getPlayerWithRole(roles, ROLE.THIEF);
    if (thiefPlayerId) {
      updatedRoles[thiefPlayerId] = nightActions.thief;
      events.push(`Night ${phase}: A shadowy figure stole a role in the dark.`);
    }
  }

  let eliminatedId = nightActions.werewolf || null;
  const witchSaved = nightActions.witchSave === eliminatedId;
  const witchKilled = nightActions.witchPoison || null;
  const newLovers = nightActions.cupid || lovers || null;

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
    const witchId = getPlayerWithRole(updatedRoles, ROLE.WITCH);
    if (witchId) updatedPotions[witchId] = { ...updatedPotions[witchId], save: false };
  }
  if (witchKilled) {
    const witchId = getPlayerWithRole(updatedRoles, ROLE.WITCH);
    if (witchId) updatedPotions[witchId] = { ...updatedPotions[witchId], poison: false };
  }

  for (const pid of disconnectedPlayers) {
    const p = players.find((pl) => pl.id === pid && pl.isAlive);
    if (p && !allEliminated.has(pid)) {
      events.push(`Night ${phase}: ${p.nickname} abandoned the village and was lost.`);
      const ids = await eliminateWithLoverChain(roomId, pid, players, newLovers, events, `Night ${phase}`);
      ids.forEach((id) => allEliminated.add(id));
    }
  }

  const updatedPlayers = players.map((p) =>
    allEliminated.has(p.id) ? { ...p, isAlive: false } : p
  );

  const winner = checkWinCondition(updatedPlayers, updatedRoles, newLovers);
  const hunterTriggered = [...allEliminated].find((id) => updatedRoles[id] === ROLE.HUNTER) || null;

  await updateRoom(roomId, {
    status: winner ? 'ended' : 'day',
    winner: winner || null,
    roles: updatedRoles,
    eliminatedThisNight: eliminatedId,
    witchPotions: updatedPotions,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    lovers: newLovers,
    hunterTriggered: hunterTriggered || null,
    disconnectedPlayers: [],
    events: arrayUnion(...events),
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
  const { votes, players, roles, phase, lovers, disconnectedPlayers = [] } = roomData;
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

  for (const pid of disconnectedPlayers) {
    const p = players.find((pl) => pl.id === pid && pl.isAlive);
    if (p && !allEliminated.has(pid)) {
      events.push(`Day ${phase}: ${p.nickname} abandoned the village and was lost.`);
      const ids = await eliminateWithLoverChain(roomId, pid, players, lovers, events, `Day ${phase}`);
      ids.forEach((id) => allEliminated.add(id));
    }
  }

  const updatedPlayers = players.map((p) =>
    allEliminated.has(p.id) ? { ...p, isAlive: false } : p
  );

  const winner = checkWinCondition(updatedPlayers, roles, lovers);
  const hunterTriggered = [...allEliminated].find((id) => roles[id] === ROLE.HUNTER) || null;
  const advanceToNight = !!eliminatedId && !winner && !hunterTriggered;

  await updateRoom(roomId, {
    winner: winner || null,
    status: winner ? 'ended' : (advanceToNight ? 'night' : 'day'),
    hunterTriggered: hunterTriggered || null,
    votes: {},
    accusedPlayerId: null,
    disconnectedPlayers: [],
    phaseStartedAt: new Date().toISOString(),
    events: arrayUnion(...events),
    ...(advanceToNight && { phase: phase + 1, nightActions: {}, eliminatedThisNight: null }),
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

  const updatedPlayers = players.map((p) =>
    allEliminated.has(p.id) ? { ...p, isAlive: false } : p
  );
  const winner = checkWinCondition(updatedPlayers, roles, lovers);

  await updateRoom(roomId, {
    winner: winner || null,
    status: winner ? 'ended' : roomData.status,
    hunterTriggered: null,
    events: arrayUnion(...events),
  });
}
