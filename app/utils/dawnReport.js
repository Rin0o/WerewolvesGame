import { ROLE, ROLE_DEFINITIONS, hasVillagePower } from '../constants/roles';
import { getLoversPartner } from '../game-logic/roles';
import { RAVEN_VOTES, activeRavenMark } from '../game-logic/voteManager';

function findPlayer(room, id) {
  return (room.players || []).find((p) => p.id === id) || null;
}

function nightVictims(room) {
  const { eliminatedThisNight } = room;
  const ids = Array.isArray(eliminatedThisNight) ? eliminatedThisNight : (eliminatedThisNight ? [eliminatedThisNight] : []);
  return ids.map((id) => findPlayer(room, id)).filter(Boolean);
}

export function publicDawnNews(room) {
  const roles = room.roles || {};
  const victims = nightVictims(room);
  const news = victims.map((victim) => {
    const role = roles[victim.id];
    const info = ROLE_DEFINITIONS[role];
    return {
      key: `dead-${victim.id}`,
      icon: role || 'dead',
      tone: 'danger',
      title: `${victim.nickname} was found dead`,
      detail: `They were the ${info?.name || '?'}.`,
      team: info?.team || null,
      short: `☠ ${victim.nickname}`,
    };
  });
  if (victims.length === 0) {
    news.push({ key: 'peaceful', icon: 'moon', tone: 'calm', title: 'A peaceful night', detail: 'Nobody died last night.', short: '🌙 Peaceful night' });
  }
  if (room.bearTamerGrowl === true) {
    news.push({ key: 'growl', icon: 'bear_growl', tone: 'warning', title: 'The bears growled at dawn', detail: 'A werewolf sits next to the Bear Tamer.', short: '🐻 Growl' });
  }
  const marked = findPlayer(room, activeRavenMark(room));
  if (marked?.isAlive) {
    news.push({
      key: 'raven',
      icon: ROLE.RAVEN,
      tone: 'warning',
      title: `The raven marked ${marked.nickname}`,
      detail: `They start today's vote with ${RAVEN_VOTES} votes against them.`,
      short: `🐦‍⬛ ${marked.nickname} +${RAVEN_VOTES}`,
    });
  }
  if (room.villagePowersLost) {
    news.push({
      key: 'elder',
      icon: ROLE.ELDER,
      tone: 'danger',
      title: 'The village killed its Elder',
      detail: 'Every villager has lost their power for the rest of the game.',
      short: 'Elder killed',
    });
  }
  return news;
}

export function privateDawnNews(room, playerId) {
  const me = findPlayer(room, playerId);
  if (!me || me.isNarrator || !me.isAlive) return [];
  const myRole = room.roles?.[playerId];
  const news = [];

  const lover = findPlayer(room, getLoversPartner(playerId, room.lovers));
  if (lover) {
    news.push({
      key: 'lover',
      icon: ROLE.CUPID,
      tone: 'private',
      title: 'You are in love',
      detail: `Your lover is ${lover.nickname}. If they die, you die too. If you are the last two alive, you win together.`,
    });
  }
  if (myRole === ROLE.BEAR_TAMER && typeof room.bearTamerGrowl === 'boolean') {
    news.push(room.bearTamerGrowl
      ? { key: 'bears', icon: 'bear_growl', tone: 'private', title: 'Your bears are growling!', detail: 'At least one of your neighbours is a Werewolf.' }
      : { key: 'bears', icon: ROLE.BEAR_TAMER, tone: 'private', title: 'Your bears are silent', detail: 'Neither of your neighbours is a Werewolf.' });
  }
  if (myRole === ROLE.ELDER && room.elderWoundedNight === room.phase) {
    news.push({
      key: 'elder-survived',
      icon: ROLE.ELDER,
      tone: 'private',
      title: 'You survived the night',
      detail: 'You were attacked last night and survived. The next wolf attack will be fatal. The village was not told.',
    });
  }
  if (myRole && !hasVillagePower(room, myRole)) {
    news.push({ key: 'power-lost', icon: ROLE.ELDER, tone: 'private', title: 'Your power is gone', detail: elderPowerLostText(myRole) });
  }
  return news;
}

function elderPowerLostText(myRole) {
  return `As the ${ROLE_DEFINITIONS[myRole]?.name}, you lost your power for the rest of the game when the village killed its Elder.`;
}

export function nightReminder(room, myRole, { wolfHasDied = false } = {}) {
  if (!hasVillagePower(room, myRole)) return { icon: ROLE.ELDER, text: elderPowerLostText(myRole) };
  if (myRole === ROLE.ELDER && room.elderWoundedNight) {
    return { icon: ROLE.ELDER, text: 'You have already survived one wolf attack. The next one will kill you.' };
  }
  if (myRole === ROLE.FOX && room.foxPowerLost) {
    return { icon: ROLE.FOX, text: 'You have lost your power. As the Fox, you no longer wake up at night.' };
  }
  if (myRole === ROLE.BIG_BAD_WOLF && wolfHasDied) {
    return { icon: ROLE.BIG_BAD_WOLF, text: 'A wolf has died. You still hunt with the pack, but you no longer take a second victim.' };
  }
  return null;
}

export function dawnSummary(publicNews, privateCount) {
  const parts = publicNews.map((n) => n.short);
  if (privateCount > 0) parts.push(`👁 ${privateCount} for you`);
  return parts.join(' · ');
}
