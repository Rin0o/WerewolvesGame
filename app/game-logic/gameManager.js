import { arrayUnion } from 'firebase/firestore';
import { ROLE, getCompositionForCount, isWolfRole } from '../constants/roles';
import { assignRoles, checkWinCondition, getPlayerWithRole, getLoversPartner, getAvailableRolesForThief } from './roles';
import { tallyVotes } from './voteManager';
import {
  getRoom,
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
  return isWolfRole(roles[left.id]) || isWolfRole(roles[right.id]);
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

  const packWolfAlive = players.some((p) => p.isAlive && roles[p.id] === ROLE.WEREWOLF);

  const wakes = {
    thief: isActive(ROLE.THIEF) && getAvailableRolesForThief(roles).length > 0,
    cupid: isActive(ROLE.CUPID),
    wolf_hound: isActive(ROLE.WOLF_HOUND),
    saviour: isActive(ROLE.SAVIOUR),
    werewolf: isActive(ROLE.WEREWOLF) || isActive(ROLE.WHITE_WOLF),
    white_wolf: phase % 2 === 0 && isActive(ROLE.WHITE_WOLF) && packWolfAlive,
    witch: witchHasPotions,
    seer: isActive(ROLE.SEER),
  };
  return nightOrder(room).filter((step) => wakes[step]);
}

const QUIET_FIRST_NIGHT_ORDER = ['thief', 'cupid', 'wolf_hound', 'werewolf'];
const CLASSIC_FIRST_NIGHT_ORDER = ['thief', 'cupid', 'wolf_hound', 'saviour', 'werewolf', 'witch', 'seer'];
const LATER_NIGHT_ORDER = ['saviour', 'werewolf', 'white_wolf', 'witch', 'seer'];

export function isQuietFirstNight(room) {
  return room.phase === 1 && !room.classicFirstNight;
}

function nightOrder(room) {
  if (room.phase !== 1) return LATER_NIGHT_ORDER;
  return room.classicFirstNight ? CLASSIC_FIRST_NIGHT_ORDER : QUIET_FIRST_NIGHT_ORDER;
}

export function nextNightSubPhase(room, current) {
  const order = nightOrder(room);
  const active = computeNightSequence(room);
  return order.slice(order.indexOf(current) + 1).find((step) => active.includes(step)) || 'done';
}

function wolfHoundChoiceUpdate(room) {
  const { roles = {}, nightActions = {}, phase } = room;
  const houndId = getPlayerWithRole(roles, ROLE.WOLF_HOUND);
  const choice = nightActions.wolfHound;
  if (!houndId || (choice !== ROLE.WEREWOLF && choice !== ROLE.VILLAGER)) return null;
  return {
    roles: { ...roles, [houndId]: choice },
    event: `Night ${phase}: The Wolf Hound chose a side.`,
  };
}

export function advanceNightUpdate(room, next) {
  const update = { nightSubPhase: next };
  if (room.nightSubPhase !== 'wolf_hound') return update;
  const houndChoice = wolfHoundChoiceUpdate(room);
  if (!houndChoice) return update;
  const nextRoom = { ...room, roles: houndChoice.roles };
  return {
    roles: houndChoice.roles,
    nightSubPhase: next === 'done' ? 'done' : nextNightSubPhase(nextRoom, 'wolf_hound'),
    events: arrayUnion(houndChoice.event),
  };
}

export function isSubPhaseDone(subPhase, room) {
  const { nightActions = {} } = room;
  switch (subPhase) {
    case 'thief':    return !!nightActions.thief;
    case 'cupid':    return Array.isArray(nightActions.cupid) && nightActions.cupid.length === 2;
    case 'wolf_hound': return !!nightActions.wolfHound;
    case 'werewolf': return isQuietFirstNight(room) ? nightActions.werewolfObserved === true : !!nightActions.werewolf;
    case 'white_wolf': return !!nightActions.whiteWolf || nightActions.whiteWolfSkip === true;
    case 'witch':    return nightActions.witchSave !== undefined || !!nightActions.witchPoison || nightActions.witchSkip === true;
    case 'seer':     return !!nightActions.seer;
    case 'saviour':  return !!nightActions.saviour;
    default:         return false;
  }
}

export async function startGame(roomId, players, customComposition = null, classicFirstNight = false) {
  const clearingChat = clearWerewolfChat(roomId).catch(() => {});
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
    const botRoles = [];
    const humanRoles = [];
    for (const role of shuffleArr(composition)) {
      const botCanPlay = role === ROLE.WEREWOLF || role === ROLE.VILLAGER;
      if (botCanPlay && botRoles.length < botPlayers.length) botRoles.push(role);
      else humanRoles.push(role);
    }
    shuffleArr(humanPlayers).forEach((p, i) => {
      const role = humanRoles[i] || ROLE.VILLAGER;
      roleMap[p.id] = role;
      if (role === ROLE.WITCH) witchPotions[p.id] = { save: true, poison: true };
    });
    botPlayers.forEach((bot, i) => {
      roleMap[bot.id] = botRoles[i] || ROLE.VILLAGER;
    });
  } else {
    const result = assignRoles(humanPlayers, customComposition);
    roleMap = result.roleMap;
    witchPotions = result.witchPotions;
  }

  if (narratorPlayers.length > 0) allPlayers = [...allPlayers, ...narratorPlayers];

  const nightSeq = computeNightSequence({
    players: allPlayers, roles: roleMap, phase: 1, witchPotions, disconnectedPlayers: [], classicFirstNight,
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
    hunterDiedDuring: null,
    disconnectedPlayers: [],
    saviourLastProtected: null,
    bearTamerGrowl: null,
  });
  await clearingChat;
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
  const houndChoice = wolfHoundChoiceUpdate(roomData);
  if (houndChoice) {
    updatedRoles = houndChoice.roles;
    events.push(houndChoice.event);
  }
  if (nightActions.thief) {
    const thiefPlayerId = getPlayerWithRole(roles, ROLE.THIEF);
    if (thiefPlayerId) {
      updatedRoles[thiefPlayerId] = nightActions.thief;
      events.push(`Night ${phase}: A shadowy figure stole a role in the dark.`);
    }
  }

  const quiet = isQuietFirstNight(roomData);
  const saviourProtected = nightActions.saviour || null;
  let eliminatedId = quiet ? null : (nightActions.werewolf || null);
  const witchSaved = nightActions.witchSave === eliminatedId;
  const witchKilled = quiet ? null : (nightActions.witchPoison || null);
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
  const nightDeathCauses = {};
  const recordDeaths = (ids, cause) => {
    ids.forEach((id, i) => {
      allEliminated.add(id);
      nightDeathCauses[id] = i === 0 ? cause : 'heartbreak';
    });
  };

  if (eliminatedId) {
    const victim = players.find((p) => p.id === eliminatedId);
    events.push(`Night ${phase}: ${victim?.nickname || 'Someone'} was eliminated by the werewolves.`);
    const ids = await eliminateWithLoverChain(roomId, eliminatedId, players, newLovers, events, `Night ${phase}`);
    recordDeaths(ids, 'werewolves');
  } else if (quiet) {
    events.push(`Night 1: The werewolves lurked in the shadows, but did not strike.`);
  } else if (!witchSaved && !saviourBlocked && !witchKilled && !nightActions.whiteWolf) {
    events.push(`Night ${phase}: The village was peaceful — no one was eliminated.`);
  }

  if (witchKilled && !allEliminated.has(witchKilled)) {
    const poisoned = players.find((p) => p.id === witchKilled);
    events.push(`Night ${phase}: ${poisoned?.nickname || 'Someone'} was poisoned by the witch.`);
    const ids = await eliminateWithLoverChain(roomId, witchKilled, players, newLovers, events, `Night ${phase}`);
    recordDeaths(ids, 'poison');
  }

  const whiteWolfPrey = phase === 1 ? null : players.find((p) => p.id === nightActions.whiteWolf && p.isAlive);
  if (whiteWolfPrey && !allEliminated.has(whiteWolfPrey.id)) {
    events.push(`Night ${phase}: ${whiteWolfPrey.nickname} was torn apart in the night.`);
    const ids = await eliminateWithLoverChain(roomId, whiteWolfPrey.id, players, newLovers, events, `Night ${phase}`);
    recordDeaths(ids, 'white_wolf');
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
      recordDeaths(ids, 'abandoned');
    }
  }

  const updatedPlayers = players.map((p) =>
    allEliminated.has(p.id) ? { ...p, isAlive: false } : p
  );

  const hunterTriggered = [...allEliminated].find((id) => updatedRoles[id] === ROLE.HUNTER) || null;
  const winner = hunterTriggered ? null : checkWinCondition(updatedPlayers, updatedRoles, newLovers);
  const bearTamerGrowl = computeBearTamerGrowl(updatedPlayers.filter((p) => p.isAlive), updatedRoles);

  await updateRoom(roomId, {
    status: winner ? 'ended' : 'day',
    winner: winner || null,
    roles: updatedRoles,
    eliminatedThisNight: [...allEliminated],
    nightDeathCauses,
    witchPotions: updatedPotions,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    lovers: newLovers,
    hunterTriggered: hunterTriggered || null,
    hunterDiedDuring: hunterTriggered ? 'night' : null,
    disconnectedPlayers: [],
    saviourLastProtected: saviourProtected,
    bearTamerGrowl,
    events: arrayUnion(...events),
  });

  return { winner, eliminatedId };
}

export async function startNextNight(roomId) {
  const room = await getRoom(roomId);
  if (!room || room.status !== 'day' || room.winner || room.hunterTriggered) return;
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
    hunterDiedDuring: null,
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

  const hunterTriggered = [...allEliminated].find((id) => roles[id] === ROLE.HUNTER) || null;
  const winner = hunterTriggered ? null : checkWinCondition(updatedPlayers, roles, lovers);
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
    hunterDiedDuring: hunterTriggered ? 'day' : null,
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

  return { winner };
}
