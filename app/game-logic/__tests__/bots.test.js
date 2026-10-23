import { botSeats, pickBotNames } from '../bots';
import { BOT_NAMES, BOT_MARK } from '../../constants/botNames';

describe('botSeats', () => {
  it('fills the empty seats up to the target', () => {
    expect(botSeats(3, 5)).toEqual({ bots: 2, missing: 0 });
  });

  it('never fills more than half the table', () => {
    expect(botSeats(2, 5)).toEqual({ bots: 2, missing: 1 });
    expect(botSeats(1, 5)).toEqual({ bots: 1, missing: 3 });
    expect(botSeats(4, 10)).toEqual({ bots: 4, missing: 2 });
  });

  it('adds nothing when the table is already full', () => {
    expect(botSeats(5, 5)).toEqual({ bots: 0, missing: 0 });
    expect(botSeats(7, 5)).toEqual({ bots: 0, missing: 0 });
  });

  it('adds nothing for an empty room', () => {
    expect(botSeats(0, 5)).toEqual({ bots: 0, missing: 5 });
  });
});

describe('BOT_NAMES', () => {
  it('has no duplicates and every name fits the nickname limit', () => {
    expect(new Set(BOT_NAMES.map((name) => name.toUpperCase())).size).toBe(BOT_NAMES.length);
    BOT_NAMES.forEach((name) => expect(name.length).toBeLessThanOrEqual(18));
  });
});

describe('pickBotNames', () => {
  it('picks distinct themed names marked as bots', () => {
    const names = pickBotNames(4);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(4);
    names.forEach((name) => {
      expect(name.endsWith(` ${BOT_MARK}`)).toBe(true);
      expect(BOT_NAMES).toContain(name.replace(` ${BOT_MARK}`, ''));
    });
  });

  it('never reuses a human player\'s name', () => {
    const taken = BOT_NAMES.slice(0, BOT_NAMES.length - 2).map((name) => name.toUpperCase());
    const names = pickBotNames(2, taken).map((name) => name.replace(` ${BOT_MARK}`, ''));
    expect(names.sort()).toEqual(BOT_NAMES.slice(-2).sort());
  });

  it('picks names at random', () => {
    const first = new Set();
    for (let i = 0; i < 100; i++) first.add(pickBotNames(1)[0]);
    expect(first.size).toBeGreaterThan(1);
  });

  it('still names every bot when the list runs out', () => {
    expect(pickBotNames(BOT_NAMES.length + 2)).toHaveLength(BOT_NAMES.length + 2);
  });
});
