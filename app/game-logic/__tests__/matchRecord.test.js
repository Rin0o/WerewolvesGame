import { didWin, winnersOf, canRecordMatch, matchRecordId, matchToRecord, buildMatchRecord } from '../matchRecord';
import { makeGame } from './helpers';

function ended(roles, winner, overrides = {}) {
  return makeGame(roles, { status: 'ended', winner, gameStartedAt: 1000, ...overrides });
}

describe('winnersOf', () => {
  const roles = { wolf: 'werewolf', white: 'white_wolf', seer: 'seer', hound: 'wolf_hound', anna: 'villager' };

  it('the village wins with every villager-side role', () => {
    expect(winnersOf(ended(roles, 'villagers'))).toEqual(['seer', 'hound', 'anna']);
  });

  it('the werewolves win with the pack, never the White Wolf', () => {
    expect(winnersOf(ended(roles, 'werewolves'))).toEqual(['wolf']);
  });

  it('the White Wolf wins alone', () => {
    expect(winnersOf(ended(roles, 'white_wolf'))).toEqual(['white']);
  });

  it('the lovers win together, whatever their team', () => {
    expect(winnersOf(ended(roles, 'lovers', { lovers: ['wolf', 'anna'] }))).toEqual(['wolf', 'anna']);
  });

  it('an infected player wins with the wolves, not the village', () => {
    const room = ended(roles, 'werewolves', { infectedId: 'seer' });
    expect(winnersOf(room)).toEqual(['wolf', 'seer']);
    expect(didWin({ ...room, winner: 'villagers' }, 'seer')).toBe(false);
  });

  it('the narrator never wins', () => {
    const room = ended({ anna: 'villager' }, 'villagers');
    room.players.push({ id: 'nar', nickname: 'Nar', isAlive: true, isNarrator: true });
    expect(winnersOf(room)).toEqual(['anna']);
  });
});

describe('canRecordMatch', () => {
  it('needs an ended game with a winner and a start time', () => {
    expect(canRecordMatch(ended({ anna: 'villager' }, 'villagers'))).toBe(true);
    expect(canRecordMatch(ended({ anna: 'villager' }, null))).toBe(false);
    expect(canRecordMatch(ended({ anna: 'villager' }, 'villagers', { status: 'day' }))).toBe(false);
    expect(canRecordMatch(ended({ anna: 'villager' }, 'villagers', { gameStartedAt: undefined }))).toBe(false);
    expect(canRecordMatch(null)).toBe(false);
  });
});

describe('matchToRecord', () => {
  const room = ended({ anna: 'villager' }, 'villagers', { hostId: 'anna' });

  it('the host saves an ended game under its id', () => {
    expect(matchToRecord('r', room, 'anna', null)).toBe('r_1000');
  });

  it('other players never save it', () => {
    expect(matchToRecord('r', room, 'bob', null)).toBeNull();
  });

  it('saves each game only once per phone', () => {
    expect(matchToRecord('r', room, 'anna', 'r_1000')).toBeNull();
  });

  it('a new host after a takeover saves it too', () => {
    expect(matchToRecord('r', { ...room, hostId: 'bob' }, 'bob', null)).toBe('r_1000');
  });

  it('the next game in the same room gets its own record', () => {
    expect(matchToRecord('r', { ...room, gameStartedAt: 2000 }, 'anna', 'r_1000')).toBe('r_2000');
  });

  it('waits for the game to end, and never saves after Play Again', () => {
    expect(matchToRecord('r', { ...room, status: 'day', winner: null }, 'anna', null)).toBeNull();
    expect(matchToRecord('r', { ...room, status: 'lobby', winner: null }, 'anna', null)).toBeNull();
    expect(matchToRecord('r', null, 'anna', null)).toBeNull();
  });
});

describe('buildMatchRecord', () => {
  const room = ended(
    { anna: 'villager', wolf: 'werewolf', 'bot-0': 'villager' },
    'villagers',
    { code: 'ABCDE', phase: 4, gameMode: 'custom', tieRule: 'revote', roleComposition: { villager: 2, werewolf: 1 }, dead: ['wolf'] },
  );
  room.players[1].isAlive = false;
  room.players[2].isBot = true;
  room.players.push({ id: 'nar', nickname: 'Nar', isAlive: true, isNarrator: true });

  it('is keyed by room and start time', () => {
    expect(matchRecordId('room-1', 1000)).toBe('room-1_1000');
  });

  it('lists real players for the queries, bots only in the cast', () => {
    const record = buildMatchRecord('room-1', room);
    expect(record).toMatchObject({
      roomId: 'room-1',
      code: 'ABCDE',
      gameStartedAt: 1000,
      gameMode: 'custom',
      classicFirstNight: false,
      tieRule: 'revote',
      rounds: 4,
      winner: 'villagers',
      withBots: true,
      narratorId: 'nar',
      playerIds: ['anna', 'wolf', 'nar'],
      winnerIds: ['anna'],
    });
    expect(record.players).toEqual([
      { id: 'anna', nickname: 'Anna', role: 'villager', infected: false, won: true, alive: true, isBot: false, isNarrator: false },
      { id: 'wolf', nickname: 'Wolf', role: 'werewolf', infected: false, won: false, alive: false, isBot: false, isNarrator: false },
      { id: 'bot-0', nickname: 'Bot-0', role: 'villager', infected: false, won: true, alive: true, isBot: true, isNarrator: false },
      { id: 'nar', nickname: 'Nar', role: null, infected: false, won: false, alive: true, isBot: false, isNarrator: true },
    ]);
  });

  it('fills defaults for rooms without the lobby options', () => {
    const record = buildMatchRecord('r', ended({ anna: 'villager' }, 'villagers'));
    expect(record).toMatchObject({ gameMode: 'normal', tieRule: 'no_lynch', withBots: false, narratorId: null, code: null });
    expect(record).toMatchObject({ events: [], history: [] });
  });

  it('keeps the event log and the hidden actions for the replay', () => {
    const events = ['Game started with 3 players.', 'Night 1: the wolves met.'];
    const history = [{ time: 'night', round: 1, act: 'seer', by: 'anna', target: 'wolf' }];
    const record = buildMatchRecord('r', { ...room, events, history });
    expect(record.events).toEqual(events);
    expect(record.history).toEqual(history);
  });
});
