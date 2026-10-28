import { ROLE } from '../constants/roles';
import { getAvailableRolesForThief, getPlayerWithRole } from './roles';
import { allVotesIn } from './voteManager';
import {
  computeNightSequence,
  nextNightSubPhase,
  isSubPhaseDone,
  advanceNightUpdate,
  isQuietFirstNight,
  livingWolves,
  wolfPrey,
  wolfVoteOutcome,
  wolfOutcomeUpdate,
  leadingWolfTarget,
  WOLF_OUTCOME,
  ROLE_REVEAL_STEP,
} from './gameManager';

const SUBPHASE_SECONDS = 45;
const SUBPHASE_SECONDS_OVERRIDES = { thief: 30, cupid: 30, wolf_hound: 15, seer: 25, saviour: 25, white_wolf: 25, fox: 25 };
const OBSERVE_ONLY_WEREWOLF_SECONDS = 15;
export const WOLF_REVOTE_SECONDS = 30;

const DISCUSSION_SECONDS_PER_PLAYER = 30;
const DISCUSSION_MIN_SECONDS = 90;
const DISCUSSION_MAX_SECONDS = 240;

export function subPhaseSeconds(subPhase, room) {
  if (subPhase === 'werewolf' && isQuietFirstNight(room)) return OBSERVE_ONLY_WEREWOLF_SECONDS;
  if (subPhase === 'werewolf' && room.nightActions?.wolfRevoteTargets) return WOLF_REVOTE_SECONDS;
  return SUBPHASE_SECONDS_OVERRIDES[subPhase] ?? SUBPHASE_SECONDS;
}

export function discussionSecondsFor(livingPlayers) {
  return Math.min(DISCUSSION_MAX_SECONDS, Math.max(DISCUSSION_MIN_SECONDS, livingPlayers * DISCUSSION_SECONDS_PER_PLAYER));
}

function nightActionUpdate(key, value) {
  return { update: { [`nightActions.${key}`]: value } };
}

function isWerewolfStepOpen(room) {
  return !!room && room.status === 'night' && room.nightSubPhase === 'werewolf' && !isSubPhaseDone('werewolf', room);
}

export function advanceNightPlan(room) {
  const next = nextNightSubPhase(room, room.nightSubPhase);
  return next === 'done' ? { resolveNight: room } : { update: advanceNightUpdate(room, next) };
}

export function hostNightPlan(room) {
  if (!room || room.status !== 'night') return null;
  const step = room.nightSubPhase;
  const revealing = step === ROLE_REVEAL_STEP;
  const hostAdvances = room.gameMode !== 'narrator' || revealing;
  if (!step) return hostAdvances ? { update: { nightSubPhase: computeNightSequence(room)[0] || 'done' } } : null;
  if (step === 'done') return null;
  const activePlayerLeft = !revealing && !computeNightSequence(room).includes(step);
  if (isSubPhaseDone(step, room) || activePlayerLeft) return hostAdvances ? advanceNightPlan(room) : null;
  if (step !== 'werewolf' || isQuietFirstNight(room)) return null;
  const update = wolfOutcomeUpdate(wolfVoteOutcome(room));
  return update ? { update } : null;
}

export function nightTimeoutPlan(room) {
  if (!room || room.status !== 'night') return null;
  const step = room.nightSubPhase;
  if (!step || step === 'done' || isSubPhaseDone(step, room)) return null;
  const { players = [], roles = {}, saviourLastProtected = null } = room;
  const living = players.filter((p) => p.isAlive && !p.isNarrator);
  const othersThan = (role) => living.filter((p) => p.id !== getPlayerWithRole(roles, role));
  switch (step) {
    case 'werewolf': {
      if (isQuietFirstNight(room)) return nightActionUpdate('werewolfObserved', true);
      const update = wolfOutcomeUpdate(wolfVoteOutcome(room, { force: true }));
      return update ? { update } : null;
    }
    case 'wolf_hound':
      return nightActionUpdate('wolfHound', ROLE.VILLAGER);
    case 'white_wolf':
      return nightActionUpdate('whiteWolfSkip', true);
    case 'witch':
      return nightActionUpdate('witchSkip', true);
    case 'fox':
      return nightActionUpdate('foxSkip', true);
    case 'seer': {
      const inspectable = othersThan(ROLE.SEER);
      return inspectable.length > 0 ? nightActionUpdate('seer', inspectable[0].id) : null;
    }
    case 'cupid': {
      const lovers = living.slice(0, 2).map((p) => p.id);
      return lovers.length === 2 ? nightActionUpdate('cupid', lovers) : null;
    }
    case 'thief': {
      const available = getAvailableRolesForThief(roles);
      return available.length > 0 ? nightActionUpdate('thief', available[0]) : null;
    }
    case 'saviour': {
      const protectable = othersThan(ROLE.SAVIOUR).filter((p) => p.id !== saviourLastProtected);
      return protectable.length > 0 ? nightActionUpdate('saviour', protectable[0].id) : null;
    }
    default:
      return null;
  }
}

export function narratorAdvancePlan(room) {
  if (room.nightSubPhase !== 'werewolf' || isQuietFirstNight(room) || isSubPhaseDone('werewolf', room)) {
    return advanceNightPlan(room);
  }
  const outcome = wolfVoteOutcome(room, { force: true });
  const update = wolfOutcomeUpdate(outcome);
  if (outcome.type === WOLF_OUTCOME.REVOTE) return { update };
  const decided = outcome.type === WOLF_OUTCOME.KILL ? { werewolf: outcome.target } : { wolfNoKill: true };
  const settled = { ...room, nightActions: { ...room.nightActions, ...decided } };
  const advance = advanceNightPlan(settled);
  return advance.resolveNight ? { update, resolveNight: settled } : { update: { ...update, ...advance.update } };
}

export function botWolvesToWake(room) {
  if (!isWerewolfStepOpen(room)) return [];
  const wolves = livingWolves(room);
  const bots = wolves.filter((w) => w.isBot);
  if (!isQuietFirstNight(room)) return bots;
  return bots.length === wolves.length ? bots.slice(0, 1) : [];
}

export function botWolfMove(room, botId, random = Math.random) {
  if (!isWerewolfStepOpen(room)) return null;
  if (isQuietFirstNight(room)) return { observe: true };
  const { nightActions = {} } = room;
  if (nightActions.wolfVotes?.[botId]) return null;
  const allowed = nightActions.wolfRevoteTargets || wolfPrey(room).map((p) => p.id);
  const leading = leadingWolfTarget(room);
  const target = leading || (allowed.length > 0 ? allowed[Math.floor(random() * allowed.length)] : null);
  return target ? { target, followsLeader: !!leading } : null;
}

function dayVoters(room) {
  return (room.players || []).filter((p) => p.isAlive && !p.isNarrator);
}

export function allDayVotesCast(room) {
  return allVotesIn(room.votes || {}, dayVoters(room), room.disconnectedPlayers || []);
}

export function votingDone(room) {
  return !!room.votesClosed || allDayVotesCast(room);
}

export function humansAllVoted(room) {
  const disconnected = room.disconnectedPlayers || [];
  return dayVoters(room)
    .filter((p) => !p.isBot && !disconnected.includes(p.id))
    .every((p) => room.votes?.[p.id]);
}

export function botsYetToVote(room) {
  if (!room || room.status !== 'day' || room.votesClosed) return [];
  return (room.players || []).filter((p) => p.isBot && p.isAlive && !room.votes?.[p.id]);
}

export function botMaySpeak(room, botId) {
  return !!room && room.status === 'day' && !room.votesClosed && !room.hunterTriggered
    && (room.players || []).some((p) => p.id === botId && p.isAlive);
}
