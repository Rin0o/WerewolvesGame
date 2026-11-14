// Werewolves balance simulator: all roles, first-night rule, tie rule, bots.
// play(setup) -> 'village' | 'wolves' | 'lovers' | 'white_wolf'
// setup = { roles: [...tokens], bots, classic, revote }
// Tokens: V W Se Wi H C T S B Si F WC I R E BB WF WW WH (Si = one Sister; sisters come in pairs)

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => (arr.length ? arr[rand(arr.length)] : undefined);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const BOT_PLAYABLE = new Set(['V', 'W', 'Si', 'I', 'E']);
const WOLF_ROLES = new Set(['W', 'BB', 'WF', 'WW']);
const SILENCED = new Set(['Se', 'Wi', 'S', 'F', 'R', 'H', 'B', 'I']);
const THIEF_OPTIONS = ['V', 'W', 'Se', 'Wi', 'H', 'C'];

const P = {
  tieNoLynch: 0.15,
  tieRevote: 0.06,
  sisterVouch: 0.5,
  ravenFollow: 0.4,
  suspectFollow: 0.7,
  houndPicksWolves: 0.4,
};

function deal(roles, bots) {
  const n = roles.length;
  const seats = shuffle([...Array(n).keys()]);
  const botSeats = new Set(seats.slice(0, bots));
  const humans = seats.slice(bots);
  const humanOnly = shuffle(roles.filter((r) => !BOT_PLAYABLE.has(r)));
  const botOk = shuffle(roles.filter((r) => BOT_PLAYABLE.has(r)));
  const byId = new Array(n);
  humanOnly.forEach((r, i) => {
    if (i < humans.length) byId[humans[i]] = r;
    else botOk.push(WOLF_ROLES.has(r) ? 'W' : 'V');
  });
  const free = shuffle([...humans.slice(humanOnly.length), ...seats.slice(0, bots)]);
  const rest = shuffle(botOk);
  free.forEach((id, i) => { byId[id] = rest[i] || 'V'; });
  return byId.map((role, id) => ({ id, role, team: WOLF_ROLES.has(role) ? (role === 'WW' ? 'WW' : 'W') : 'V', alive: true, bot: botSeats.has(id), infected: false }));
}

function play(setup) {
  const { roles, bots = 0, classic = false, revote = false } = setup;
  const players = deal(roles, bots);
  const alive = () => players.filter((p) => p.alive);
  const holder = (role) => players.find((p) => p.alive && p.role === role);
  let powersLost = false;
  const power = (p) => p && p.alive && !p.infected && !(powersLost && SILENCED.has(p.role));
  let lovers = null;
  const knownWolves = new Set();
  const cleared = new Set();
  let suspects = new Set();
  let seerRevealed = false;
  let witchSave = true;
  let witchPoison = true;
  let saviourLast = null;
  let elderWounded = false;
  let foxLost = false;
  let wolfDied = false;
  let infectUsed = false;
  let idiotRevealed = false;
  let wildModel = null;
  let ravenMark = null;

  const isPack = (p) => p.team === 'W';
  const isAnyWolf = (p) => p.team === 'W' || p.team === 'WW';

  function neighbours(p) {
    const ring = players.filter((q) => q.alive || q === p);
    const i = ring.indexOf(p);
    const out = [ring[(i - 1 + ring.length) % ring.length], ring[(i + 1) % ring.length]];
    return [...new Set(out.filter((q) => q !== p && q.alive))];
  }

  function kill(p, how) {
    if (!p || !p.alive) return;
    p.alive = false;
    if (isAnyWolf(p)) wolfDied = true;
    if (p.role === 'E' && (how === 'lynch' || how === 'poison' || how === 'hunter')) powersLost = true;
    if (lovers && lovers.includes(p.id)) {
      const other = players[lovers.find((id) => id !== p.id)];
      if (other.alive) kill(other, 'heartbreak');
    }
    if (p.role === 'H' && !p.infected && !(powersLost && SILENCED.has('H'))) {
      const known = alive().filter((q) => knownWolves.has(q.id));
      const pool = alive().filter((q) => !cleared.has(q.id));
      kill(known[0] || pick(pool) || pick(alive()), 'hunter');
    }
    const child = holder('WC');
    if (child && wildModel === p.id) { child.role = 'W'; child.team = 'W'; }
  }

  function winner() {
    const a = alive();
    if (lovers && a.length === 2 && lovers.every((id) => players[id].alive)) {
      const [x, y] = lovers.map((id) => players[id]);
      if (x.team !== y.team) return 'lovers';
    }
    const ww = a.filter((p) => p.team === 'WW').length;
    const pack = a.filter(isPack).length;
    if (ww === 1 && a.length === 1) return 'white_wolf';
    if (pack === 0 && ww === 0) return 'village';
    if (pack > 0 && pack >= a.length - pack) return 'wolves';
    return null;
  }

  function firstNight() {
    const thief = holder('T');
    if (thief) {
      const options = THIEF_OPTIONS.filter((r) => !roles.includes(r));
      const r = pick(options) || 'V';
      thief.role = r;
      thief.team = WOLF_ROLES.has(r) ? 'W' : 'V';
      if (r === 'C') thief.role = 'C';
    }
    const hound = holder('WH');
    if (hound) {
      const wolf = Math.random() < P.houndPicksWolves;
      hound.role = wolf ? 'W' : 'V';
      hound.team = wolf ? 'W' : 'V';
    }
    if (holder('C')) {
      const [x, y] = shuffle(players).slice(0, 2);
      lovers = [x.id, y.id];
    }
    const child = holder('WC');
    if (child) wildModel = pick(players.filter((p) => p !== child)).id;
  }

  function night(n) {
    const quiet = n === 1 && !classic;
    if (quiet) return;

    const saviour = holder('S');
    let protectedId = null;
    if (power(saviour)) {
      const seer = holder('Se');
      const options = alive().filter((p) => p !== saviour && p.id !== saviourLast);
      protectedId = seerRevealed && seer && seer !== saviour && seer.id !== saviourLast ? seer.id : pick(options)?.id;
      saviourLast = protectedId;
    }

    const fox = holder('F');
    if (power(fox) && !foxLost) {
      const target = pick(alive().filter((p) => p !== fox && !cleared.has(p.id)));
      if (target) {
        const group = [target, ...neighbours(target)];
        if (group.some(isAnyWolf)) group.filter((q) => q !== fox).forEach((q) => suspects.add(q.id));
        else { group.forEach((q) => cleared.add(q.id)); foxLost = true; }
      }
    }

    const seer = holder('Se');
    const prey = alive().filter((p) => !isAnyWolf(p));
    let victim = seerRevealed && seer && !seer.infected ? seer : pick(prey);
    let victimDies = !!victim && victim.id !== protectedId;
    const father = holder('WF');
    if (victimDies && father && !infectUsed) {
      infectUsed = true;
      victim.infected = true;
      victim.team = 'W';
      victimDies = false;
    }
    const witch = holder('Wi');
    if (victimDies && power(witch) && witchSave) { witchSave = false; victimDies = false; }
    if (victimDies && victim.role === 'E' && !elderWounded) { elderWounded = true; victimDies = false; }
    if (victimDies) kill(victim, 'wolves');

    const bigBad = holder('BB');
    if (bigBad && !wolfDied) {
      const extra = pick(alive().filter((p) => !isAnyWolf(p)));
      if (extra && extra.id !== protectedId) {
        if (extra.role === 'E' && !elderWounded) elderWounded = true;
        else kill(extra, 'wolves');
      }
    }

    const white = holder('WW');
    if (white && n % 2 === 0) {
      const packWolf = pick(alive().filter(isPack));
      if (packWolf) kill(packWolf, 'white');
    }

    if (power(witch) && witchPoison) {
      const target = alive().find((p) => knownWolves.has(p.id));
      if (target) { witchPoison = false; kill(target, 'poison'); }
    }

    if (power(seer)) {
      const checked = pick(alive().filter((p) => p !== seer && !cleared.has(p.id) && !knownWolves.has(p.id)));
      if (checked) {
        if (isAnyWolf(checked)) { knownWolves.add(checked.id); seerRevealed = true; } else cleared.add(checked.id);
      }
    }

    const raven = holder('R');
    ravenMark = null;
    if (power(raven)) {
      const known = alive().find((p) => knownWolves.has(p.id));
      const target = known || pick(alive().filter((p) => p !== raven && !cleared.has(p.id)));
      ravenMark = target?.id ?? null;
    }
  }

  function day() {
    const bear = holder('B');
    if (power(bear)) {
      const nb = neighbours(bear);
      if (nb.some(isAnyWolf)) nb.forEach((q) => suspects.add(q.id));
      else nb.forEach((q) => cleared.add(q.id));
    }

    const a = alive();
    const botsAlive = a.filter((p) => p.bot).length;
    let target;
    if (Math.random() < botsAlive / a.length) {
      target = pick(a);
    } else {
      const known = a.find((p) => knownWolves.has(p.id));
      if (known) target = known;
      else if (Math.random() < (revote ? P.tieRevote : P.tieNoLynch)) target = null;
      else {
        const marked = ravenMark !== null ? players[ravenMark] : null;
        if (marked && marked.alive && !cleared.has(marked.id) && Math.random() < P.ravenFollow) target = marked;
        else {
          const trusted = (p) => cleared.has(p.id) || (p.role === 'Si' && Math.random() < P.sisterVouch);
          const pool = a.filter((p) => !trusted(p));
          const sus = pool.filter((p) => suspects.has(p.id));
          target = (sus.length && Math.random() < P.suspectFollow ? pick(sus) : pick(pool)) || pick(a);
        }
      }
    }
    ravenMark = null;
    if (!target) return;
    if (target.role === 'I' && !idiotRevealed && !(powersLost)) {
      idiotRevealed = true;
      cleared.add(target.id);
      return;
    }
    kill(target, 'lynch');
  }

  firstNight();
  for (let n = 1; n < 40; n++) {
    night(n);
    let w = winner();
    if (w) return w;
    day();
    w = winner();
    if (w) return w;
  }
  return 'village';
}

function rate(setup, games = 2000) {
  const wins = { village: 0, wolves: 0, lovers: 0, white_wolf: 0 };
  for (let i = 0; i < games; i++) wins[play(setup)]++;
  return { village: wins.village / games, wolves: wins.wolves / games, lovers: wins.lovers / games, white_wolf: wins.white_wolf / games };
}

module.exports = { play, rate, P };
