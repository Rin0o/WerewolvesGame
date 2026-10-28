import { arrayUnion } from 'firebase/firestore';
import { ROLE, getCompositionForCount, isWolfRole } from '../constants/roles';
import { assignRoles, checkWinCondition, getPlayerWithRole, getLoversPartner, getAvailableRolesForThief, getSeating, getLivingNeighbours, foxSmellsWolf } from './roles';
import { tallyVotes, ravenVotes, RAVEN_VOTES } from './voteManager';
import {
  getRoom,
  updateRoom,
  eliminatePlayer,
  clearNightActions,
  clearWerewolfChat,
  clearSisterChat,
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
    wild_child: isActive(ROLE.WILD_CHILD),
    wolf_hound: isActive(ROLE.WOLF_HOUND),
    saviour: isActive(ROLE.SAVIOUR),
    fox: isActive(ROLE.FOX) && !room.foxPowerLost,
    werewolf: isActive(ROLE.WEREWOLF) || isActive(ROLE.WHITE_WOLF),
    white_wolf: phase % 2 === 0 && isActive(ROLE.WHITE_WOLF) && packWolfAlive,
    witch: witchHasPotions,
    seer: isActive(ROLE.SEER),
    raven: isActive(ROLE.RAVEN),
  };
  return nightOrder(room).filter((step) => wakes[step]);
}

const QUIET_FIRST_NIGHT_ORDER = ['thief', 'cupid', 'wild_child', 'wolf_hound', 'werewolf'];
const CLASSIC_FIRST_NIGHT_ORDER = ['thief', 'cupid', 'wild_child', 'wolf_hound', 'saviour', 'fox', 'werewolf', 'witch', 'seer', 'raven'];
const LATER_NIGHT_ORDER = ['saviour', 'fox', 'werewolf', 'white_wolf', 'witch', 'seer', 'raven'];

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

export const WOLF_OUTCOME = { WAIT: 'wait', KILL: 'kill', REVOTE: 'revote', NO_KILL: 'no_kill' };

function randomOf(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function wolfPrey(room) {
  const { players = [], roles = {} } = room;
  return players.filter((p) => p.isAlive && !isWolfRole(roles[p.id]) && !p.isNarrator);
}

function castWolfVotes(room) {
  const { players = [], nightActions = {} } = room;
  const votes = nightActions.wolfVotes || {};
  const allowed = nightActions.wolfRevoteTargets || null;
  const isValid = (id) => players.some((p) => p.id === id && p.isAlive) && (!allowed || allowed.includes(id));
  return livingWolves(room).map((w) => votes[w.id]).filter(isValid);
}

function mostVoted(targets) {
  const counts = targets.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
  const top = Math.max(...Object.values(counts));
  return Object.keys(counts).filter((id) => counts[id] === top);
}

export function leadingWolfTarget(room) {
  const targets = castWolfVotes(room);
  return targets.length ? randomOf(mostVoted(targets)) : null;
}

export function wolfVoteOutcome(room, { force = false } = {}) {
  const revoteTargets = room.nightActions?.wolfRevoteTargets || null;
  const targets = castWolfVotes(room);
  if (!force && targets.length < livingWolves(room).length) return { type: WOLF_OUTCOME.WAIT };
  if (targets.length === 0) {
    if (!force) return { type: WOLF_OUTCOME.WAIT };
    const pool = revoteTargets
      ? revoteTargets.filter((id) => (room.players || []).some((p) => p.id === id && p.isAlive))
      : wolfPrey(room).map((p) => p.id);
    return pool.length ? { type: WOLF_OUTCOME.KILL, target: randomOf(pool) } : { type: WOLF_OUTCOME.NO_KILL };
  }
  const tied = mostVoted(targets);
  if (tied.length === 1) return { type: WOLF_OUTCOME.KILL, target: tied[0] };
  return revoteTargets ? { type: WOLF_OUTCOME.NO_KILL } : { type: WOLF_OUTCOME.REVOTE, targets: tied };
}

export function wolfOutcomeUpdate(outcome) {
  switch (outcome.type) {
    case WOLF_OUTCOME.KILL: return { 'nightActions.werewolf': outcome.target };
    case WOLF_OUTCOME.REVOTE: return { 'nightActions.wolfVotes': {}, 'nightActions.wolfRevoteTargets': outcome.targets };
    case WOLF_OUTCOME.NO_KILL: return { 'nightActions.wolfNoKill': true };
    default: return null;
  }
}

export function isSubPhaseDone(subPhase, room) {
  const { nightActions = {} } = room;
  switch (subPhase) {
    case ROLE_REVEAL_STEP: return playersStillReading(room).length === 0;
    case 'thief':    return !!nightActions.thief;
    case 'cupid':    return Array.isArray(nightActions.cupid) && nightActions.cupid.length === 2;
    case 'wild_child': return !!nightActions.wildChild;
    case 'wolf_hound': return !!nightActions.wolfHound;
    case 'werewolf': return isQuietFirstNight(room)
      ? nightActions.werewolfObserved === true
      : !!nightActions.werewolf || nightActions.wolfNoKill === true;
    case 'white_wolf': return !!nightActions.whiteWolf || nightActions.whiteWolfSkip === true;
    case 'witch':    return nightActions.witchSave !== undefined || !!nightActions.witchPoison || nightActions.witchSkip === true;
    case 'seer':     return !!nightActions.seer;
    case 'saviour':  return !!nightActions.saviour;
    case 'fox':      return !!nightActions.fox || nightActions.foxSkip === true;
    case 'raven':    return !!nightActions.raven || nightActions.ravenSkip === true;
    default:         return false;
  }
}

function countRoles(roleMap) {
  return Object.values(roleMap).reduce((acc, role) => ({ ...acc, [role]: (acc[role] || 0) + 1 }), {});
}

const BOT_PLAYABLE_SPECIALS = [ROLE.SISTER, ROLE.VILLAGE_IDIOT];

function dealWithBots(humanPlayers, botPlayers, composition) {
  const wolfCount = composition.filter((r) => r === ROLE.WEREWOLF).length;
  const specials = composition.filter((r) => r !== ROLE.WEREWOLF && r !== ROLE.VILLAGER);
  const humanOnly = shuffleArr(specials.filter((r) => !BOT_PLAYABLE_SPECIALS.includes(r)));
  const botPlayable = specials.filter((r) => BOT_PLAYABLE_SPECIALS.includes(r));
  const wolfIds = new Set(shuffleArr([...humanPlayers, ...botPlayers]).slice(0, wolfCount).map((p) => p.id));

  const humanWolves = shuffleArr(humanPlayers.filter((p) => wolfIds.has(p.id)));
  const wolfFreeBots = shuffleArr(botPlayers.filter((p) => !wolfIds.has(p.id)));
  while (humanPlayers.length - humanWolves.length < humanOnly.length && humanWolves.length > 0 && wolfFreeBots.length > 0) {
    wolfIds.delete(humanWolves.pop().id);
    wolfIds.add(wolfFreeBots.pop().id);
  }

  const freeHumans = shuffleArr(humanPlayers.filter((p) => !wolfIds.has(p.id)));
  const forHumans = [...humanOnly, ...shuffleArr(botPlayable)];
  const humanRoles = forHumans.slice(0, freeHumans.length);
  const leftForBots = forHumans.slice(freeHumans.length).filter((r) => BOT_PLAYABLE_SPECIALS.includes(r));

  const roleMap = {};
  const witchPotions = {};
  freeHumans.forEach((p, i) => {
    const role = humanRoles[i] || ROLE.VILLAGER;
    roleMap[p.id] = role;
    if (role === ROLE.WITCH) witchPotions[p.id] = { save: true, poison: true };
  });
  shuffleArr(botPlayers.filter((p) => !wolfIds.has(p.id))).forEach((p, i) => {
    roleMap[p.id] = leftForBots[i] || ROLE.VILLAGER;
  });
  [...humanPlayers, ...botPlayers].forEach((p) => {
    if (wolfIds.has(p.id)) roleMap[p.id] = ROLE.WEREWOLF;
  });
  return { roleMap, witchPotions };
}

export async function startGame(roomId, players, { composition: customComposition = null, classicFirstNight = false, botCount = 0 } = {}) {
  const clearingChats = Promise.all([clearWerewolfChat(roomId), clearSisterChat(roomId)]).catch(() => {});
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
    foxPowerLost: false,
    wildChildId: null,
    wildChildModel: null,
    wildChildTurnedAt: null,
    idiotRevealed: null,
    ravenMark: null,
  });
  await clearingChats;
}

export function wildChildTurn(room, roles, playersAfter, eliminatedIds) {
  const { wildChildId, wildChildModel } = room;
  if (!wildChildId || !wildChildModel || roles[wildChildId] !== ROLE.WILD_CHILD) return null;
  if (!eliminatedIds.includes(wildChildModel)) return null;
  if (!playersAfter.some((p) => p.id === wildChildId && p.isAlive)) return null;
  return { roles: { ...roles, [wildChildId]: ROLE.WEREWOLF }, wildChildTurnedAt: new Date().toISOString() };
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
  const foxPowerLost = !!roomData.foxPowerLost
    || (!!nightActions.fox && !foxSmellsWolf(players, updatedRoles, nightActions.fox));
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

  const wildChild = {
    wildChildId: roomData.wildChildId || (nightActions.wildChild ? getPlayerWithRole(updatedRoles, ROLE.WILD_CHILD) : null),
    wildChildModel: roomData.wildChildModel || nightActions.wildChild || null,
  };
  const turn = wildChildTurn(wildChild, updatedRoles, updatedPlayers, [...allEliminated]);
  if (turn) updatedRoles = turn.roles;

  const markedPlayer = updatedPlayers.find((p) => p.id === nightActions.raven && p.isAlive);
  if (markedPlayer) {
    events.push(`Night ${phase}: The raven marked ${markedPlayer.nickname}, who starts today's vote with ${RAVEN_VOTES} votes against them.`);
  }

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
    foxPowerLost,
    ravenMark: markedPlayer ? markedPlayer.id : null,
    ...wildChild,
    ...(turn && { wildChildTurnedAt: turn.wildChildTurnedAt }),
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
  const { tied } = tallyVotes(room.votes || {}, ravenVotes(room));
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

export function isIdiotSpared(room, lynchedId) {
  return !!lynchedId && room.roles?.[lynchedId] === ROLE.VILLAGE_IDIOT && room.idiotRevealed !== lynchedId;
}

export async function resolveLynch(roomId, roomData) {
  const { votes, players, roles, phase, lovers, disconnectedPlayers = [] } = roomData;
  const events = [];

  const { tallyMap, eliminatedId: votedOutId, tie, tied } = tallyVotes(votes, ravenVotes(roomData));
  const sparedIdiot = isIdiotSpared(roomData, votedOutId) ? votedOutId : null;
  const eliminatedId = sparedIdiot ? null : votedOutId;

  const allEliminated = new Set();

  if (sparedIdiot) {
    const idiot = players.find((p) => p.id === sparedIdiot);
    events.push(`Day ${phase}: ${idiot?.nickname || 'Someone'} was voted out, but turned out to be the Village Idiot. The village spared them, but they can no longer vote.`);
  } else if (eliminatedId) {
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

  const turn = wildChildTurn(roomData, roles, updatedPlayers, [...allEliminated]);
  const rolesAfter = turn ? turn.roles : roles;

  const hunterTriggered = [...allEliminated].find((id) => roles[id] === ROLE.HUNTER) || null;
  const winner = hunterTriggered ? null : checkWinCondition(updatedPlayers, rolesAfter, lovers);
  const advanceToNight = !winner && !hunterTriggered;

  let nightSubPhase;
  if (advanceToNight) {
    const nextRoom = { ...roomData, roles: rolesAfter, players: updatedPlayers, phase: phase + 1, nightActions: {}, disconnectedPlayers: [] };
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
    ravenMark: null,
    disconnectedPlayers: [],
    phaseStartedAt: new Date().toISOString(),
    events: arrayUnion(...events),
    ...turn,
    ...(sparedIdiot && { idiotRevealed: sparedIdiot }),
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
  const turn = wildChildTurn(roomData, roles, updatedPlayers, [...allEliminated]);
  const winner = checkWinCondition(updatedPlayers, turn ? turn.roles : roles, lovers);

  await updateRoom(roomId, {
    winner: winner || null,
    status: winner ? 'ended' : roomData.status,
    hunterTriggered: null,
    events: arrayUnion(...events),
    ...turn,
  });

  return { winner };
}
