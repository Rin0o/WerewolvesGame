import { BOT_NAMES, BOT_MARK } from '../constants/botNames';

const normalize = (name) => (name || '').trim().toLowerCase();

export function botSeats(humanCount, targetCount) {
  return Math.max(0, targetCount - humanCount);
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
