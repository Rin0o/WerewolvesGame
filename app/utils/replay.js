import { ROLE, ROLE_DEFINITIONS } from '../constants/roles';
import { nicknameOf } from '../game-logic/roles';

const ROUND_PREFIX = /^(Night|Day) (\d+): /;

function roleName(role) {
  return ROLE_DEFINITIONS[role]?.name || role;
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function votesLine(votes, name) {
  const byTarget = {};
  votes.forEach((v) => { (byTarget[v.target] = byTarget[v.target] || []).push(name(v.by)); });
  return Object.entries(byTarget)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([target, voters]) => `${name(target)} (${voters.length}: ${voters.join(', ')})`)
    .join(' · ');
}

function actText(act, name, actor) {
  switch (act.act) {
    case 'thief': return `${actor(act.by, ROLE.THIEF)} stole the ${roleName(act.role)} card.`;
    case 'wolf_hound': return `${actor(act.by, ROLE.WOLF_HOUND)} ${act.role === ROLE.WEREWOLF ? 'joined the pack' : 'sided with the village'}.`;
    case 'cupid': return `${actor(act.by, ROLE.CUPID)} made ${name(act.targets[0])} and ${name(act.targets[1])} fall in love.`;
    case 'wild_child': return `${actor(act.by, ROLE.WILD_CHILD)} chose ${name(act.target)} as role model.`;
    case 'pack': return `The pack chose ${name(act.target)}.`;
    case 'pack_split': return 'The pack split twice: nobody was attacked.';
    case 'wolf_father': return `${actor(act.by, ROLE.WOLF_FATHER)} infected ${name(act.target)}.`;
    case 'big_bad_wolf': return `${actor(act.by, ROLE.BIG_BAD_WOLF)} went after ${name(act.target)}.`;
    case 'white_wolf': return `${actor(act.by, ROLE.WHITE_WOLF)} turned on ${name(act.target)}.`;
    case 'saviour': return `${actor(act.by, ROLE.SAVIOUR)} protected ${name(act.target)}.`;
    case 'witch_save': return `${actor(act.by, ROLE.WITCH)} used the healing potion on ${name(act.target)}.`;
    case 'witch_poison': return `${actor(act.by, ROLE.WITCH)} poisoned ${name(act.target)}.`;
    case 'seer': return `${actor(act.by, ROLE.SEER)} looked at ${name(act.target)}: ${act.wolf ? 'a Werewolf' : 'not a Werewolf'}.`;
    case 'fox': return `${actor(act.by, ROLE.FOX)} sniffed ${listNames(act.targets.map(name))}: ${act.wolf ? 'a Werewolf was there' : 'no Werewolf'}.`;
    case 'raven': return `${actor(act.by, ROLE.RAVEN)} marked ${name(act.target)}.`;
    default: return null;
  }
}

function roundKey(time, round) {
  return `${time}-${round}`;
}

function roundOf(key, rounds) {
  if (!rounds.has(key)) {
    const [time, round] = key.split('-');
    rounds.set(key, { key, title: `${time === 'night' ? 'Night' : 'Day'} ${round}`, lines: [], publicLines: [] });
  }
  return rounds.get(key);
}

/**
 * Game Over's "what really happened": one entry per night and day, in order. Each holds the hidden
 * actions from room.history (secret: true) followed by that round's public event-log lines.
 * Lines logged before night 1 has any round prefix (the game start) come back as `intro`.
 */
export function replayRounds(room) {
  const players = room.players || [];
  const name = (id) => nicknameOf(players, id);
  const actor = (id, role) => (id ? `${name(id)} (${roleName(role)})` : `The ${roleName(role)}`);
  const rounds = new Map();
  const intro = [];

  let current = null;
  (room.events || []).forEach((line) => {
    const match = line.match(ROUND_PREFIX);
    if (match) current = roundKey(match[1].toLowerCase(), match[2]);
    const text = match ? line.slice(match[0].length) : line;
    if (current) roundOf(current, rounds).publicLines.push(text);
    else intro.push(text);
  });

  const ballots = new Map();
  (room.history || []).forEach((act) => {
    const entry = roundOf(roundKey(act.time, act.round), rounds);
    if (act.act === 'vote' || act.act === 'wolf_vote') {
      const key = `${entry.key}|${act.act}|${act.ballot || 1}`;
      if (!ballots.has(key)) {
        const line = { text: '', secret: true };
        entry.lines.push(line);
        ballots.set(key, { line, label: act.act === 'wolf_vote' ? 'The pack voted' : act.ballot === 2 ? 'Revote' : 'Votes', votes: [] });
      }
      ballots.get(key).votes.push(act);
      return;
    }
    const text = actText(act, name, actor);
    if (text) entry.lines.push({ text, secret: true });
  });
  ballots.forEach(({ line, label, votes }) => {
    line.text = `${label}: ${votesLine(votes, name)}.`;
  });

  const order = (r) => {
    const [time, round] = r.key.split('-');
    return Number(round) * 2 + (time === 'day' ? 1 : 0);
  };
  const sorted = [...rounds.values()].sort((a, b) => order(a) - order(b)).map((r) => ({
    key: r.key,
    title: r.title,
    lines: [...r.lines, ...r.publicLines.map((text) => ({ text, secret: false }))],
  }));
  return { intro, rounds: sorted };
}
