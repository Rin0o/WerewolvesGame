import { ROLE, isWolfRole, teamRoles } from '../constants/roles';
import { getPlayerWithRole, getFoxGroup } from './roles';

const NIGHT_ROLE_ACTS = [
  ['saviour', ROLE.SAVIOUR, 'saviour'],
  ['witchSave', ROLE.WITCH, 'witch_save'],
  ['witchPoison', ROLE.WITCH, 'witch_poison'],
  ['bigBadWolf', ROLE.BIG_BAD_WOLF, 'big_bad_wolf'],
  ['whiteWolf', ROLE.WHITE_WOLF, 'white_wolf'],
  ['raven', ROLE.RAVEN, 'raven'],
];

export function thiefAct(round, thiefId, stolenRole) {
  return { time: 'night', round, act: 'thief', by: thiefId, role: stolenRole };
}

export function wolfHoundAct(round, houndId, side) {
  return { time: 'night', round, act: 'wolf_hound', by: houndId, role: side };
}

/**
 * The hidden actions of a night, as history entries, from the room before resolveNight applies them.
 * `roles` are the roles after the Thief and Wolf Hound choices, so each act names who really did it.
 */
export function nightActs(room, roles) {
  const { nightActions: actions = {}, phase: round, players = [] } = room;
  const night = (act, fields) => ({ time: 'night', round, act, ...fields });
  const seenAs = teamRoles(roles, room.infectedId);
  const acts = [];

  if (actions.cupid?.length === 2) {
    acts.push(night('cupid', { by: getPlayerWithRole(roles, ROLE.CUPID), targets: actions.cupid }));
  }
  if (actions.wildChild) {
    acts.push(night('wild_child', { by: getPlayerWithRole(roles, ROLE.WILD_CHILD), target: actions.wildChild }));
  }
  Object.entries(actions.wolfVotes || {}).forEach(([by, target]) => acts.push(night('wolf_vote', { by, target })));
  if (actions.werewolf) acts.push(night('pack', { target: actions.werewolf }));
  if (actions.wolfNoKill) acts.push(night('pack_split', {}));
  if (actions.wolfFather === true && actions.werewolf) {
    acts.push(night('wolf_father', { by: getPlayerWithRole(roles, ROLE.WOLF_FATHER), target: actions.werewolf }));
  }
  if (actions.seer) {
    acts.push(night('seer', { by: getPlayerWithRole(roles, ROLE.SEER), target: actions.seer, wolf: isWolfRole(seenAs[actions.seer]) }));
  }
  if (actions.fox) {
    const group = getFoxGroup(players, actions.fox);
    acts.push(night('fox', {
      by: getPlayerWithRole(roles, ROLE.FOX),
      target: actions.fox,
      targets: group,
      wolf: group.some((id) => isWolfRole(seenAs[id])),
    }));
  }
  NIGHT_ROLE_ACTS.forEach(([key, role, act]) => {
    if (actions[key]) acts.push(night(act, { by: getPlayerWithRole(roles, role), target: actions[key] }));
  });
  return acts;
}

export function dayVoteActs(room) {
  const ballot = room.revoteTargets?.length ? 2 : 1;
  return Object.entries(room.votes || {})
    .filter(([, vote]) => vote?.target)
    .map(([by, vote]) => ({ time: 'day', round: room.phase, act: 'vote', ballot, by, target: vote.target }));
}
