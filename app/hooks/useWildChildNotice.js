import { useState } from 'react';
import { ROLE } from '../constants/roles';
import { getWerewolves } from '../game-logic/roles';

const dismissedNotices = new Set();

export function wildChildNotice(room, playerId) {
  if (!room || room.wildChildId !== playerId || !room.wildChildTurnedAt) return null;
  if (room.roles?.[playerId] !== ROLE.WEREWOLF) return null;
  const players = room.players || [];
  const nameOf = (id) => players.find((p) => p.id === id)?.nickname || '?';
  const livingPack = getWerewolves(room.roles)
    .filter((id) => id !== playerId && players.some((p) => p.id === id && p.isAlive));
  return {
    key: `${room.code}:${playerId}:${room.wildChildTurnedAt}`,
    modelName: nameOf(room.wildChildModel),
    pack: livingPack.map(nameOf),
  };
}

export default function useWildChildNotice(room, playerId) {
  const [, rerender] = useState(0);
  const notice = wildChildNotice(room, playerId);
  if (!notice || dismissedNotices.has(notice.key)) return { notice: null, dismiss: () => {} };
  return {
    notice,
    dismiss: () => {
      dismissedNotices.add(notice.key);
      rerender((n) => n + 1);
    },
  };
}
