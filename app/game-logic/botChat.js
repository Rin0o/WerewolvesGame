import { BOT_LINES } from '../constants/botLines';
import { isWolfRole } from '../constants/roles';

const pickFrom = (items, random) => items[Math.floor(random() * items.length)];
const fill = (template, name) => template.replace('{name}', name);
const nicknameOf = (room, id) => (room.players || []).find((p) => p.id === id)?.nickname || '?';

export function botVoteTarget(room, botId, random = Math.random) {
  const { players = [], roles = {}, revoteTargets = null } = room;
  const botIsWolf = isWolfRole(roles[botId]);
  const eligible = players.filter((p) =>
    p.isAlive
    && p.id !== botId
    && !p.isNarrator
    && (!revoteTargets?.length || revoteTargets.includes(p.id)));
  const outsidePack = eligible.filter((p) => !(botIsWolf && isWolfRole(roles[p.id])));
  const pool = outsidePack.length ? outsidePack : eligible;
  return pool.length ? pickFrom(pool, random).id : null;
}

export function botDayChatter(room, botId, targetId, random = Math.random) {
  if (room.revoteTargets?.length) return [];
  const lines = [];
  const victims = (room.eliminatedThisNight || []).filter((id) => id !== botId);
  if (random() < 0.6) {
    if (room.bearTamerGrowl === true && random() < 0.5) lines.push(pickFrom(BOT_LINES.growl, random));
    else if (victims.length) lines.push(fill(pickFrom(BOT_LINES.dawnDeath, random), nicknameOf(room, pickFrom(victims, random))));
    else lines.push(pickFrom(BOT_LINES.dawnPeace, random));
  }
  if (targetId && random() < 0.7) {
    lines.push(random() < 0.8
      ? fill(pickFrom(BOT_LINES.suspicion, random), nicknameOf(room, targetId))
      : pickFrom(BOT_LINES.defense, random));
  }
  return lines;
}

export function botVoteLine(room, targetId, random = Math.random) {
  const lines = room.revoteTargets?.length ? BOT_LINES.revote : BOT_LINES.vote;
  return fill(pickFrom(lines, random), nicknameOf(room, targetId));
}

export function botWolfLine(room, targetId, agreeing, random = Math.random) {
  return fill(pickFrom(agreeing ? BOT_LINES.wolfAgree : BOT_LINES.wolfPick, random), nicknameOf(room, targetId));
}
