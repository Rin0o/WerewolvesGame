import { ROLE, teamRoles, isWolfRole } from '../constants/roles';
import { getFoxGroup, getLivingNeighbours, getLoversPartner, nicknameOf } from '../game-logic/roles';

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function suspectAll(ids, level) {
  return Object.fromEntries(ids.map((id) => [id, level]));
}

export function privateClues(room, playerId) {
  const players = room?.players || [];
  const me = players.find((p) => p.id === playerId);
  if (!me || me.isNarrator || room.status === 'lobby') return [];
  const roles = room.roles || {};
  const myRole = roles[playerId];
  const team = teamRoles(roles, room.infectedId);
  const actions = room.status === 'night' ? room.nightActions || {} : {};
  const { phase } = room;
  const name = (id) => nicknameOf(players, id);
  const clues = [];

  const lover = getLoversPartner(playerId, room.lovers);
  if (lover) {
    clues.push({ key: 'lover', text: `Cupid's arrow: your lover is ${name(lover)}. If one of you dies, so does the other.` });
  }
  if (myRole === ROLE.CUPID && room.lovers?.length === 2) {
    clues.push({ key: 'cupid', text: `You made ${name(room.lovers[0])} and ${name(room.lovers[1])} lovers.` });
  }
  if (room.wildChildId === playerId && room.wildChildModel) {
    clues.push({ key: 'model', text: `Your role model is ${name(room.wildChildModel)}. If they die, you become a Werewolf.` });
  }

  if (myRole === ROLE.SEER && actions.seer) {
    const isWolf = isWolfRole(team[actions.seer]);
    clues.push({
      key: `seer-${phase}`,
      text: `Night ${phase}: your vision showed that ${name(actions.seer)} ${isWolf ? 'is a Werewolf' : 'is not a Werewolf'}.`,
      suspicions: { [actions.seer]: isWolf ? 'very_suspicious' : 'innocent' },
    });
  }
  if (myRole === ROLE.FOX && actions.fox) {
    const group = getFoxGroup(players, actions.fox);
    const foundWolf = group.some((id) => isWolfRole(team[id]));
    const names = listNames(group.map((id) => (id === playerId ? 'you' : name(id))));
    clues.push({
      key: `fox-${phase}`,
      text: `Night ${phase}: you sniffed ${names}: ${foundWolf ? 'a Werewolf is among them' : 'no Werewolf among them'}.`,
      suspicions: suspectAll(group.filter((id) => id !== playerId), foundWolf ? 'suspicious' : 'innocent'),
    });
  }
  if (myRole === ROLE.RAVEN && actions.raven) {
    clues.push({ key: `raven-${phase}`, text: `Night ${phase}: you marked ${name(actions.raven)}.` });
  }

  if (room.status === 'day' && me.isAlive && myRole === ROLE.BEAR_TAMER && typeof room.bearTamerGrowl === 'boolean') {
    const neighbours = [...new Set(getLivingNeighbours(players, playerId))];
    const [first, second] = neighbours.map(name);
    const verdict = room.bearTamerGrowl
      ? `your bears growled. ${second ? `${first} or ${second}` : first} is a Werewolf.`
      : `your bears were silent. ${second ? `Neither ${first} nor ${second} is` : `${first} is not`} a Werewolf.`;
    if (neighbours.length > 0) {
      clues.push({
        key: `bears-${phase}`,
        text: `Day ${phase}: ${verdict}`,
        suspicions: suspectAll(neighbours, room.bearTamerGrowl ? 'suspicious' : 'innocent'),
      });
    }
  }
  return clues;
}

export function addClues(notes, clues) {
  const known = new Set(notes.clues.map((c) => c.key));
  const fresh = clues.filter((c) => !known.has(c.key));
  if (fresh.length === 0) return notes;
  const suspicions = { ...notes.suspicions };
  fresh.forEach((clue) => {
    Object.entries(clue.suspicions || {}).forEach(([id, level]) => {
      if (!suspicions[id]) suspicions[id] = level;
    });
  });
  return { ...notes, suspicions, clues: [...notes.clues, ...fresh.map(({ key, text }) => ({ key, text }))] };
}
