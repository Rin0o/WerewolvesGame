import { useState } from 'react';
import { ROLE, ROLE_DEFINITIONS, teamRoles } from '../constants/roles';
import { getWerewolves, nicknameOf } from '../game-logic/roles';

const dismissedNotices = new Set();

function livingPackNames(room, playerId) {
  const players = room.players || [];
  return getWerewolves(teamRoles(room.roles, room.infectedId))
    .filter((id) => id !== playerId && players.some((p) => p.id === id && p.isAlive))
    .map((id) => nicknameOf(players, id));
}

const PACK_CHANGES = [
  'You now win with the werewolves, not the village.',
  'Each night you wake with the pack and vote for its victim.',
  'You can talk with the pack in the wolf chat.',
];

export function wildChildNotice(room, playerId) {
  if (!room || room.wildChildId !== playerId || !room.wildChildTurnedAt) return null;
  if (room.roles?.[playerId] !== ROLE.WEREWOLF) return null;
  return {
    key: `${room.code}:${playerId}:${room.wildChildTurnedAt}`,
    fromRole: ROLE.WILD_CHILD,
    title: 'You are now a Werewolf',
    cause: `Your role model, ${nicknameOf(room.players, room.wildChildModel)}, is dead. Grief has turned you: you have left the village and joined the pack.`,
    changes: PACK_CHANGES,
    pack: livingPackNames(room, playerId),
  };
}

function potionsLeft(room, playerId) {
  const potions = room.witchPotions?.[playerId] || {};
  const left = [potions.save && 'the healing potion', potions.poison && 'the poison potion'].filter(Boolean);
  return left.length ? `You still have ${left.join(' and ')}.` : 'You have no potions left.';
}

export function infectedNotice(room, playerId) {
  if (!room || room.infectedId !== playerId || !room.infectedAt) return null;
  if (!(room.players || []).some((p) => p.id === playerId && p.isAlive)) return null;
  const role = room.roles?.[playerId];
  const roleName = ROLE_DEFINITIONS[role]?.name || 'Villager';
  const keepsPower = role === ROLE.WITCH
    ? `You are still the Witch, with your potions exactly as they were. ${potionsLeft(room, playerId)}`
    : `You are still the ${roleName}, and keep its power.`;
  return {
    key: `${room.code}:${playerId}:${room.infectedAt}`,
    fromRole: role,
    title: 'You have been infected',
    cause: 'The Accursed Wolf-Father bit you last night. You survived, but the curse has taken hold: you are one of the pack now.',
    changes: [keepsPower, ...PACK_CHANGES],
    pack: livingPackNames(room, playerId),
  };
}

export default function useTurnedWolfNotice(room, playerId) {
  const [, rerender] = useState(0);
  const notice = [wildChildNotice(room, playerId), infectedNotice(room, playerId)]
    .find((n) => n && !dismissedNotices.has(n.key)) || null;
  if (!notice) return { notice: null, dismiss: () => {} };
  return {
    notice,
    dismiss: () => {
      dismissedNotices.add(notice.key);
      rerender((n) => n + 1);
    },
  };
}
