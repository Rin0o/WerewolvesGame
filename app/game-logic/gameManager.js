import { arrayUnion } from 'firebase/firestore';
import { ROLE, getCompositionForCount } from '../constants/roles';
import { assignRoles, checkWinCondition, getPlayerWithRole, getLoversPartner, getAvailableRolesForThief } from './roles';
import { tallyVotes } from './voteManager';
import {
  updateRoom,
  eliminatePlayer,
  clearNightActions,
  clearWerewolfChat,
} from '../firebase/roomService';
import { BOT_CONFIG } from '../constants/devConfig';

function computeBearTamerGrowl(alivePlayers, roles) {
  const idx = alivePlayers.findIndex((p) => roles[p.id] === ROLE.BEAR_TAMER);
  if (idx === -1) return null;
  const n = alivePlayers.length;
  if (n < 2) return false;
  const left = alivePlayers[(idx - 1 + n) % n];
  const right = alivePlayers[(idx + 1) % n];
  return roles[left.id] === ROLE.WEREWOLF || roles[right.id] === ROLE.WEREWOLF;
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function computeNightSequence(room) {
  const { players = [], roles = {}, phase, disconnectedPlayers = [], witchPotions = {} } = room;
  const isActive = (role) =>
    players.some((p) => p.isAlive && roles[p.id] === role && !disconnectedPlayers.includes(p.id));
  const witchPlayer = players.find(
    (p) => p.isAlive && roles[p.id] === ROLE.WITCH && !disconnectedPlayers.includes(p.id)
  );
  const potions = witchPlayer ? witchPotions[witchPlayer.id] : null;
  const witchHasPotions = potions ? (potions.save === true || potions.poison === true) : false;

  if (phase === 1) {
    const seq = [];
    if (isActive(ROLE.THIEF) && getAvailableRolesForThief(roles).length > 0) seq.push('thief');
    if (isActive(ROLE.CUPID)) seq.push('cupid');
    seq.push('werewolf');
    if (isActive(ROLE.SEER)) seq.push('seer');
    return seq;
  }
  const seq = [];
  if (isActive(ROLE.SAVIOUR)) seq.push('saviour');
  if (isActive(ROLE.WEREWOLF)) seq.push('werewolf');
  if (witchHasPotions) seq.push('witch');
  if (isActive(ROLE.SEER)) seq.push('seer');
  return seq;
}

export function isSubPhaseDone(subPhase, room) {
  const { nightActions = {}, phase } = room;
  switch (subPhase) {
    case 'thief':    return !!nightActions.thief;
    case 'cupid':    return Array.isArray(nightActions.cupid) && nightActions.cupid.length === 2;
    case 'werewolf': return phase === 1 ? nightActions.werewolfObserved === true : !!nightActions.werewolf;
    case 'witch':    return nightActions.witchSave !== undefined || !!nightActions.witchPoison || nightActions.witchSkip === true;
    case 'seer':     return !!nightActions.seer;
    case 'saviour':  return !!nightActions.saviour;
    default:         return false;
  }
}

export async function startGame(roomId, players, customComposition = null) {
  await clearWerewolfChat(roomId);
  const humanPlayers = players.filter((p) => !p.isBot && !p.isNarrator);
  const narratorPlayers = players.filter((p) => p.isNarrator);
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

  if (narratorPlayers.length > 0) allPlayers = [...allPlayers, ...narratorPlayers];

  const nightSeq = computeNightSequence({
    players: allPlayers, roles: roleMap, phase: 1, witchPotions, disconnectedPlayers: [],
  });

  await updateRoom(roomId, {
    roles: roleMap,
    witchPotions,
    players: allPlayers,
    status: 'night',
    phase: 1,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    nightSubPhase: nightSeq[0] || 'done',
    eliminatedThisNight: null,
    events: [`Game started with ${allPlayers.length} players.`],
    winner: null,
    votes: {},
    votesClosed: false,
    lovers: null,
    hunterTriggered: null,
    disconnectedPlayers: [],
    saviourLastProtected: null,
    bearTamerGrowl: null,
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

  const saviourProtected = nightActions.saviour || null;
  let eliminatedId = phase === 1 ? null : (nightActions.werewolf || null);
  const witchSaved = nightActions.witchSave === eliminatedId;
  const witchKilled = phase === 1 ? null : (nightActions.witchPoison || null);
  const newLovers = nightActions.cupid || lovers || null;

  let saviourBlocked = false;
  if (eliminatedId && eliminatedId === saviourProtected) {
    events.push(`Night ${phase}: The saviour shielded someone from the wolves' attack.`);
    eliminatedId = null;
    saviourBlocked = true;
  }

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
  } else if (phase === 1) {
    events.push(`Night 1: The werewolves lurked in the shadows, but did not strike.`);
  } else if (!witchSaved && !saviourBlocked) {
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
  const bearTamerGrowl = computeBearTamerGrowl(updatedPlayers.filter((p) => p.isAlive), updatedRoles);

  await updateRoom(roomId, {
    status: winner ? 'ended' : 'day',
    winner: winner || null,
    roles: updatedRoles,
    eliminatedThisNight: [...allEliminated],
    witchPotions: updatedPotions,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    lovers: newLovers,
    hunterTriggered: hunterTriggered || null,
    disconnectedPlayers: [],
    saviourLastProtected: saviourProtected,
    bearTamerGrowl,
    events: arrayUnion(...events),
  });

  return { winner, eliminatedId };
}

export async function startNextNight(roomId, room) {
  const newPhase = (room.phase || 1) + 1;
  const seq = computeNightSequence({ ...room, phase: newPhase, nightActions: {}, disconnectedPlayers: [] });
  await clearNightActions(roomId);
  await updateRoom(roomId, {
    status: 'night',
    phase: newPhase,
    phaseStartedAt: new Date().toISOString(),
    eliminatedThisNight: null,
    votes: {},
    votesClosed: false,
    hunterTriggered: null,
    nightSubPhase: seq[0] || 'done',
    bearTamerGrowl: null,
  });
}

export async function resolveLynch(roomId, roomData) {
  const { votes, players, roles, phase, lovers, disconnectedPlayers = [] } = roomData;
  const events = [];

  const { tallyMap, eliminatedId, tie } = tallyVotes(votes);

  const allEliminated = new Set();

  if (eliminatedId) {
    const victim = players.find((p) => p.id === eliminatedId);
    const voteCount = tallyMap[eliminatedId];
    events.push(`Day ${phase}: ${victim?.nickname || 'Someone'} was lynched by village vote (${voteCount} vote${voteCount !== 1 ? 's' : ''}). Role: ${roles[eliminatedId] || '?'}`);
    const ids = await eliminateWithLoverChain(roomId, eliminatedId, players, lovers, events, `Day ${phase}`);
    ids.forEach((id) => allEliminated.add(id));
  } else if (tie) {
    const tiedNames = Object.keys(tallyMap).map((id) => players.find((p) => p.id === id)?.nickname || '?').join(', ');
    events.push(`Day ${phase}: The vote ended in a tie (${tiedNames}) — no one was eliminated.`);
  } else {
    events.push(`Day ${phase}: No votes were confirmed — the village remains divided.`);
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
  const advanceToNight = !winner && !hunterTriggered;

  let nightSubPhase;
  if (advanceToNight) {
    const nextRoom = { ...roomData, players: updatedPlayers, phase: phase + 1, nightActions: {}, disconnectedPlayers: [] };
    const seq = computeNightSequence(nextRoom);
    nightSubPhase = seq[0] || 'done';
  }

  await updateRoom(roomId, {
    winner: winner || null,
    status: winner ? 'ended' : (advanceToNight ? 'night' : 'day'),
    hunterTriggered: hunterTriggered || null,
    votes: {},
    votesClosed: false,
    disconnectedPlayers: [],
    phaseStartedAt: new Date().toISOString(),
    events: arrayUnion(...events),
    ...(advanceToNight && { phase: phase + 1, nightActions: {}, eliminatedThisNight: null, nightSubPhase, bearTamerGrowl: null }),
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
