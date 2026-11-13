const fs = require('fs');
const path = require('path');
const { rate } = require('./sim');

const SPECIALS = ['Se', 'Wi', 'H', 'C', 'T', 'S', 'B', 'Si', 'F', 'WC', 'I', 'R', 'E', 'BB', 'WF', 'WW', 'WH'];
const SETUPS = Number(process.argv[2] || 600);
const GAMES = Number(process.argv[3] || 1500);
const OUT = path.join(__dirname, 'samples.json');

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function randomSetup() {
  for (;;) {
    const n = rnd(5, 16);
    const wolves = rnd(1, Math.max(1, Math.round(n / 3.5)));
    const roles = Array(wolves).fill('W');
    for (const r of SPECIALS) {
      if (Math.random() < 0.28) roles.push(...(r === 'Si' ? ['Si', 'Si'] : [r]));
    }
    if (roles.length >= n) continue;
    while (roles.length < n) roles.push('V');
    const bots = Math.random() < 0.4 ? rnd(1, n - 1) : 0;
    return { roles, bots, classic: Math.random() < 0.5, revote: Math.random() < 0.5 };
  }
}

const samples = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
for (let i = 0; i < SETUPS; i++) {
  const setup = randomSetup();
  samples.push({ ...setup, result: rate(setup, GAMES) });
}
fs.writeFileSync(OUT, JSON.stringify(samples));
console.log(`${samples.length} samples`);
