import { arrayUnion } from 'firebase/firestore';
import { ROLE, getCompositionForCount, isWolfRole } from '../constants/roles';
import { assignRoles, checkWinCondition, getPlayerWithRole, getLoversPartner, getAvailableRolesForThief, getSeating, getLivingNeighbours } from './roles';
import { tallyVotes } from './voteManager';
import {
  getRoom,
  updateRoom,
  eliminatePlayer,
  clearNightActions,
  clearWerewolfChat,
} from '../firebase/roomService';
import { pickBotNames } from './bots';

function computeBearTamerGrowl(players, roles) {
  const bearTamer = getSeating(players).find((p) => p.isAlive && roles[p.id] === ROLE.BEAR_TAMER);
  if (!bearTamer) return null;
  return getLivingNeighbours(players, bearTamer.id).some((id) => isWolfRole(roles[id]));
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

export const ROLE_REVEAL_STEP = 'reveal';

export function playersStillReading(room) {
  const { players = [], roleAcknowledged = [], disconnectedPlayers = [] } = room;
  return players.filter((p) =>
    p.isAlive && !p.isBot && !p.isNarrator && !disconnectedPlayers.includes(p.id) && !roleAcknowledged.includes(p.id)
  );
}

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
  const { roles = {}, nightActions = {}, witchPotions = {}, phase } = room;
  const houndId = getPlayerWithRole(roles, ROLE.WOLF_HOUND);
  const choice = nightActions.wolfHound;
  if (!houndId || (choice !== ROLE.WEREWOLF && choice !== ROLE.VILLAGER)) return null;
  return {
    roles: { ...roles, [houndId]: choice },
    witchPotions,
    event: `Night ${phase}: The Wolf Hound chose a side.`,
  };
}

function thiefChoiceUpdate(room) {
  const { roles = {}, nightActions = {}, witchPotions = {}, phase } = room;
  const thiefId = getPlayerWithRole(roles, ROLE.THIEF);
  const stolen = nightActions.thief;
  if (!thiefId || !stolen) return null;
  return {
    roles: { ...roles, [thiefId]: stolen },
    witchPotions: stolen === ROLE.WITCH ? { ...witchPotions, [thiefId]: { save: true, poison: true } } : witchPotions,
    event: `Night ${phase}: A shadowy figure stole a role in the dark.`,
  };
}

const ROLE_CHOICE_UPDATES = { thief: thiefChoiceUpdate, wolf_hound: wolfHoundChoiceUpdate };

export function advanceNightUpdate(room, next) {
  const update = { nightSubPhase: next };
  const choice = ROLE_CHOICE_UPDATES[room.nightSubPhase]?.(room);
  if (!choice) return update;
  const nextRoom = { ...room, roles: choice.roles, witchPotions: choice.witchPotions };
  return {
    roles: choice.roles,
    witchPotions: choice.witchPotions,
    nightSubPhase: next === 'done' ? 'done' : nextNightSubPhase(nextRoom, room.nightSubPhase),
    events: arrayUnion(choice.event),
  };
}

export function livingWolves(room) {
  const { players = [], roles = {}, disconnectedPlayers = [] } = room;
  return players.filter((p) => p.isAlive && isWolfRole(roles[p.id]) && !disconnectedPlayers.includes(p.id));
}

export function wolfVictim(room, { force = false } = {}) {
  const { players = [], nightActions = {} } = room;
  const votes = nightActions.wolfVotes || {};
  const wolves = livingWolves(room);
  const targets = wolves
    .map((w) => votes[w.id])
    .filter((id) => players.some((p) => p.id === id && p.isAlive));
  if (targets.length === 0 || (!force && targets.length < wolves.length)) return null;
  const counts = targets.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
  const top = Math.max(...Object.values(counts));
  const tied = Object.keys(counts).filter((id) => counts[id] === top);
  return tied[Math.floor(Math.random() * tied.length)];
}

export function isSubPhaseDone(subPhase, room) {
  const { nightActions = {} } = room;
  switch (subPhase) {
    case ROLE_REVEAL_STEP: return playersStillReading(room).length === 0;
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

function countRoles(roleMap) {
  return Object.values(roleMap).reduce((acc, role) => ({ ...acc, [role]: (acc[role] || 0) + 1 }), {});
}

function dealWithBots(humanPlayers, botPlayers, composition) {
  const wolfCount = composition.filter((r) => r === ROLE.WEREWOLF).length;
  const specials = shuffleArr(composition.filter((r) => r !== ROLE.WEREWOLF && r !== ROLE.VILLAGER));
  const wolfIds = new Set(shuffleArr([...humanPlayers, ...botPlayers]).slice(0, wolfCount).map((p) => p.id));

  const humanWolves = shuffleArr(humanPlayers.filter((p) => wolfIds.has(p.id)));
  const freeBots = shuffleArr(botPlayers.filter((p) => !wolfIds.has(p.id)));
  while (humanPlayers.length - humanWolves.length < specials.length && humanWolves.length > 0 && freeBots.length > 0) {
    wolfIds.delete(humanWolves.pop().id);
    wolfIds.add(freeBots.pop().id);
  }

  const roleMap = {};
  const witchPotions = {};
  shuffleArr(humanPlayers.filter((p) => !wolfIds.has(p.id))).forEach((p, i) => {
    const role = specials[i] || ROLE.VILLAGER;
    roleMap[p.id] = role;
    if (role === ROLE.WITCH) witchPotions[p.id] = { save: true, poison: true };
  });
  [...humanPlayers, ...botPlayers].forEach((p) => {
    if (wolfIds.has(p.id)) roleMap[p.id] = ROLE.WEREWOLF;
    else if (!roleMap[p.id]) roleMap[p.id] = ROLE.VILLAGER;
  });
  return { roleMap, witchPotions };
}

export async function startGame(roomId, players, { composition: customComposition = null, classicFirstNight = false, botCount = 0 } = {}) {
  const clearingChat = clearWerewolfChat(roomId).catch(() => {});
  const humanPlayers = players.filter((p) => !p.isBot && !p.isNarrator);
  const narratorPlayers = players.filter((p) => p.isNarrator);
  let allPlayers = humanPlayers;
  let roleMap = {};
  let witchPotions = {};

  if (botCount > 0) {
    const botNames = pickBotNames(botCount, players.map((p) => p.nickname));
    const botPlayers = botNames.map((nickname, i) => ({
      id: `bot-${i}`,
      nickname,
      isAlive: true,
      isHost: false,
      isReady: true,
      isBot: true,
    }));
    allPlayers = [...humanPlayers, ...botPlayers];

    const composition = customComposition || getCompositionForCount(allPlayers.length);
    ({ roleMap, witchPotions } = dealWithBots(humanPlayers, botPlayers, composition));
  } else {
    const result = assignRoles(humanPlayers, customComposition);
    roleMap = result.roleMap;
    witchPotions = result.witchPotions;
  }

  if (narratorPlayers.length > 0) allPlayers = [...allPlayers, ...narratorPlayers];

  await updateRoom(roomId, {
    roles: roleMap,
    witchPotions,
    players: allPlayers,
    status: 'night',
    phase: 1,
    phaseStartedAt: new Date().toISOString(),
    nightActions: {},
    nightSubPhase: ROLE_REVEAL_STEP,
    roleAcknowledged: [],
    roleComposition: countRoles(roleMap),
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
  let potionsBefore = witchPotions || {};
  for (const choiceUpdate of [thiefChoiceUpdate, wolfHoundChoiceUpdate]) {
    const choice = choiceUpdate({ ...roomData, roles: updatedRoles, witchPotions: potionsBefore });
    if (choice) {
      updatedRoles = choice.roles;
      potionsBefore = choice.witchPotions;
      events.push(choice.event);
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

  const updatedPotions = { ...potionsBefore };
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
  const bearTamerGrowl = computeBearTamerGrowl(updatedPlayers, updatedRoles);

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
    revoteTargets: null,
    events: arrayUnion(...events),
  });

  return { winner, eliminatedId };
}

function nicknames(players, ids) {
  return ids.map((id) => players.find((p) => p.id === id)?.nickname || '?');
}

export const TIE_RULE = { NO_LYNCH: 'no_lynch', REVOTE: 'revote' };

export function tiedForRevote(room) {
  if (room.tieRule !== TIE_RULE.REVOTE || room.revoteTargets?.length) return null;
  const { tied } = tallyVotes(room.votes || {});
  return tied.length > 1 ? tied : null;
}

export async function startRevote(roomId, room, tied) {
  await updateRoom(roomId, {
    votes: {},
    votesClosed: false,
    revoteTargets: tied,
    phaseStartedAt: new Date().toISOString(),
    events: arrayUnion(`Day ${room.phase}: The vote was tied between ${nicknames(room.players || [], tied).join(' and ')}. The village votes again.`),
  });
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

  const { tallyMap, eliminatedId, tie, tied } = tallyVotes(votes);

  const allEliminated = new Set();

  if (eliminatedId) {
    const victim = players.find((p) => p.id === eliminatedId);
    const voteCount = tallyMap[eliminatedId];
    events.push(`Day ${phase}: ${victim?.nickname || 'Someone'} was lynched by village vote (${voteCount} vote${voteCount !== 1 ? 's' : ''}). Role: ${roles[eliminatedId] || '?'}`);
    const ids = await eliminateWithLoverChain(roomId, eliminatedId, players, lovers, events, `Day ${phase}`);
    ids.forEach((id) => allEliminated.add(id));
  } else if (tie) {
    const tiedNames = nicknames(players, tied).join(', ');
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
    revoteTargets: null,
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
