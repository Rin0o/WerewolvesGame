# Balance simulator

Monte Carlo simulator used to calibrate the Custom-mode balance meter. The meter's weights live in
`app/constants/balance.js`; this folder is how they were found. It isn't bundled with the app.

## Files

| File | What it does |
|---|---|
| `sim.js` | Plays one game with simple rules of thumb for every role, the first-night rule, the tie rule and bots. `rate(setup, games)` returns the share of wins per side |
| `presets.js` | Sanity check: simulates the Normal-mode presets (Quiet, Classic, Revote) |
| `fit.js` | Simulates random Custom setups and appends them to `samples.json` (git-ignored) |
| `regress.js` | Fits a logistic model on `samples.json` and prints the weights |

## Recalibrating

```bash
node tools/balance-sim/presets.js
node tools/balance-sim/fit.js 3000 2000    # 3000 random setups, 2000 games each (about a minute)
node tools/balance-sim/regress.js
```

Use the "logit share" model. Multiply its weights by 25 (`BALANCE_POINTS_PER_LOGIT`) to get the "points" in
`app/constants/balance.js`: about the change in village wins, in percentage points, around a balanced game.
`base` → `BALANCE_BASE_POINTS`, `wolfShare` → `BALANCE_WOLF_SHARE_POINTS`, `n` → `BALANCE_PER_PLAYER_POINTS`,
`botShare` → `BALANCE_BOT_SHARE_POINTS`, and one entry per role in `BALANCE_ROLE_POINTS` (relative to a Villager;
wolf roles on top of the wolf share).

## Known biases (adjusted by hand in the app)

The simulated village is a perfect detective: it always follows the bears, the Fox's sniffs and every cleared
player, and the White Wolf eats a pack wolf every even night without fail. The fit therefore overstates three
roles, which the app damps by hand (fitted → used):

| Role | Fitted | Used |
|---|---|---|
| Bear Tamer | +17 | +9 |
| Fox | +15 | +8 |
| White Wolf (on top of a wolf) | +40 | +10 |

First calibration: 2026-11-13, 3000 setups × 2000 games, 92% of setups within 10 points of the fit.
