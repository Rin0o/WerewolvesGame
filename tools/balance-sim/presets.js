const { rate } = require('./sim');

const PRESETS = {
  5: 'W H V V V',
  6: 'W Se V V V V',
  7: '2W Se Wi H 2V',
  8: '2W Se Wi H 3V',
  9: '2W Se Wi H C 3V',
  10: '3W Se Wi H C B 2V',
  11: '3W Se Wi H C B 3V',
  12: '3W Se Wi H C S 2Si 2V',
  13: '4W Se Wi H C S B 2Si V',
};

function expand(line) {
  return line.split(/\s+/).flatMap((tok) => {
    const m = tok.match(/^(\d+)(\w+)$/);
    return m ? Array(Number(m[1])).fill(m[2]) : [tok];
  });
}

const extra = process.argv.slice(2);
for (const [n, line] of Object.entries(PRESETS)) {
  const roles = expand(line);
  const quiet = rate({ roles }, 6000);
  const classic = rate({ roles, classic: true }, 6000);
  const revote = rate({ roles, revote: true }, 6000);
  const pct = (x) => `${(x * 100).toFixed(0).padStart(3)}%`;
  console.log(`${n.padStart(2)} ${line.padEnd(28)} quiet ${pct(quiet.village)}  classic ${pct(classic.village)}  revote ${pct(revote.village)}`);
}

module.exports = { expand };
