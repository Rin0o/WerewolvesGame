import { BOT_NAMES, BOT_MARK } from '../constants/botNames';

const normalize = (name) => (name || '').trim().toLowerCase();

/**
 * How many bots may fill the empty seats up to targetCount. Bots never take more than
 * half the table, so there are at most as many bots as humans.
 * Returns { bots, missing } — missing is how many more humans are still needed.
 */
export function botSeats(humanCount, targetCount) {
  const empty = Math.max(0, targetCount - humanCount);
  const bots = Math.min(empty, humanCount);
  return { bots, missing: empty - bots };
}

export function pickBotNames(count, takenNames = [], random = Math.random) {
  const taken = new Set(takenNames.map(normalize));
  const pool = BOT_NAMES.filter((name) => !taken.has(normalize(name)));
  const names = [];
  while (names.length < count && pool.length > 0) {
    names.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  while (names.length < count) names.push(`Wanderer ${names.length + 1}`);
  return names.map((name) => `${name} ${BOT_MARK}`);
}
