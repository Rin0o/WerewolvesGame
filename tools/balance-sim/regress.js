const fs = require('fs');
const path = require('path');

const samples = JSON.parse(fs.readFileSync(path.join(__dirname, 'samples.json'), 'utf8'));
const TOKENS = ['V', 'W', 'Se', 'Wi', 'H', 'C', 'T', 'S', 'B', 'Si', 'F', 'WC', 'I', 'R', 'E', 'BB', 'WF', 'WW', 'WH'];
const WOLFISH = new Set(['W', 'BB', 'WF', 'WW']);

const MODELS = {
  counts: (s) => [1, ...TOKENS.map((t) => s.roles.filter((r) => r === t).length), s.bots, s.classic ? 1 : 0, s.revote ? 1 : 0],
  share: (s) => {
    const n = s.roles.length;
    const wolves = s.roles.filter((r) => WOLFISH.has(r)).length;
    return [1, ...TOKENS.slice(2).map((t) => s.roles.filter((r) => r === t).length), wolves / n, n, s.bots / n, s.classic ? 1 : 0, s.revote ? 1 : 0];
  },
};
const NAMES = {
  counts: ['base', ...TOKENS, 'bot', 'classic', 'revote'],
  share: ['base', ...TOKENS.slice(2), 'wolfShare', 'n', 'botShare', 'classic', 'revote'],
};

function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function fit(features, target) {
  const X = samples.map(features);
  const y = samples.map(target);
  const k = X[0].length;
  const XtX = Array.from({ length: k }, () => Array(k).fill(0));
  const Xty = Array(k).fill(0);
  X.forEach((row, i) => {
    for (let a = 0; a < k; a++) {
      Xty[a] += row[a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += row[a] * row[b];
    }
  });
  for (let a = 1; a < k; a++) XtX[a][a] += 1e-6;
  const w = solve(XtX, Xty);
  const pred = X.map((row) => row.reduce((s, x, i) => s + x * w[i], 0));
  const err = pred.map((p, i) => p - y[i]);
  const rmse = Math.sqrt(err.reduce((s, e) => s + e * e, 0) / err.length);
  const worst = Math.max(...err.map(Math.abs));
  return { w, rmse, worst };
}

const clip = (p) => Math.min(0.98, Math.max(0.02, p));
const logit = (p) => Math.log(clip(p) / (1 - clip(p)));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function report(name, w, features) {
  const err = samples.map((s) => sigmoid(features(s).reduce((acc, x, i) => acc + x * w[i], 0)) - s.result.village);
  const rmse = Math.sqrt(err.reduce((a, e) => a + e * e, 0) / err.length);
  const within = err.filter((e) => Math.abs(e) <= 0.1).length / err.length;
  const worst = Math.max(...err.map(Math.abs));
  console.log(`\n== logit ${name}: RMSE ${(rmse * 100).toFixed(1)} pts, ${(within * 100).toFixed(0)}% within 10 pts, worst ${(worst * 100).toFixed(1)}`);
  NAMES[name].forEach((label, i) => console.log(`${label.padEnd(10)} ${w[i].toFixed(2).padStart(7)}`));
}

for (const name of Object.keys(MODELS)) {
  const { w } = fit(MODELS[name], (s) => logit(s.result.village));
  report(name, w, MODELS[name]);
}
module.exports = { MODELS, fit, logit, sigmoid, samples };
