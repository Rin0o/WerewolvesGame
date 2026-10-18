jest.mock('../../firebase/roomService', () => ({
  updateRoom: jest.fn(() => Promise.resolve()),
  clearWerewolfChat: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import {
  startGame, computeNightSequence, nextNightSubPhase, isSubPhaseDone, playersStillReading, ROLE_REVEAL_STEP,
} from '../gameManager';
import { updateRoom, clearWerewolfChat } from '../../firebase/roomService';
import { ROLE, getCompositionForCount } from '../../constants/roles';
import { BOT_MARK } from '../../constants/botNames';
import { lastUpdate, countRoles, ROOM_ID } from './helpers';

function humans(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `h${i}`, nickname: `H${i}`, isAlive: true, isHost: i === 0, isReady: true,
  }));
}

async function start(players, options = {}) {
  await startGame(ROOM_ID, players, options);
  return lastUpdate(updateRoom);
}

beforeEach(() => jest.clearAllMocks());

describe('startGame', () => {
  it('deals the composition and opens night 1', async () => {
    const update = await start(humans(8));
    expect(countRoles(Object.values(update.roles))).toEqual(countRoles(getCompositionForCount(8)));
    expect(update).toMatchObject({ status: 'night', phase: 1, winner: null, votes: {}, nightActions: {} });
    expect(clearWerewolfChat).toHaveBeenCalledWith(ROOM_ID);
  });

  it('opens night 1 by waiting for everyone to read their role', async () => {
    const update = await start(humans(8));
    expect(update.nightSubPhase).toBe(ROLE_REVEAL_STEP);
    expect(update.roleAcknowledged).toEqual([]);
    expect(isSubPhaseDone(ROLE_REVEAL_STEP, update)).toBe(false);
    expect(nextNightSubPhase(update, ROLE_REVEAL_STEP)).toBe(computeNightSequence({ ...update, disconnectedPlayers: [] })[0]);
  });

  it('the night begins once every player still at the table has read their role', async () => {
    const update = await start(humans(5), { botCount: 2 });
    const room = { ...update, disconnectedPlayers: ['h4'] };
    expect(playersStillReading(room).map((p) => p.id)).toEqual(['h0', 'h1', 'h2', 'h3']);
    expect(isSubPhaseDone(ROLE_REVEAL_STEP, { ...room, roleAcknowledged: ['h0', 'h1', 'h2'] })).toBe(false);
    expect(isSubPhaseDone(ROLE_REVEAL_STEP, { ...room, roleAcknowledged: ['h0', 'h1', 'h2', 'h3'] })).toBe(true);
  });

  it('a classic first night can start with the saviour or wolves instead of only night-1 roles', async () => {
    const composition = ['werewolf', 'saviour', 'villager', 'villager', 'villager'];
    const quiet = await start(humans(5), { composition });
    expect(nextNightSubPhase(quiet, ROLE_REVEAL_STEP)).toBe('werewolf');
    const classic = await start(humans(5), { composition });
    expect(nextNightSubPhase({ ...classic, classicFirstNight: true }, ROLE_REVEAL_STEP)).toBe('saviour');
  });

  it('gives the witch both potions', async () => {
    const update = await start(humans(8));
    const witch = Object.keys(update.roles).find((id) => update.roles[id] === ROLE.WITCH);
    expect(update.witchPotions).toEqual({ [witch]: { save: true, poison: true } });
  });

  it('keeps the narrator in the game without a role', async () => {
    const players = [...humans(6), { id: 'nar', nickname: 'Nar', isAlive: true, isNarrator: true }];
    const update = await start(players);
    expect(update.roles.nar).toBeUndefined();
    expect(Object.keys(update.roles)).toHaveLength(6);
    expect(update.players.map((p) => p.id)).toContain('nar');
  });

  it('still starts when clearing the old wolf chat fails', async () => {
    clearWerewolfChat.mockRejectedValueOnce(new Error('offline'));
    await expect(startGame(ROOM_ID, humans(6))).resolves.toBeUndefined();
    expect(updateRoom).toHaveBeenCalled();
  });

  it('adds no bots unless asked', async () => {
    const update = await start(humans(5));
    expect(update.players.some((p) => p.isBot)).toBe(false);
  });
});

describe('startGame with bots', () => {
  it('adds the bots with themed names and deals the full composition', async () => {
    const update = await start(humans(3), { botCount: 2 });
    const bots = update.players.filter((p) => p.isBot);
    expect(bots).toHaveLength(2);
    bots.forEach((bot) => expect(bot.nickname.endsWith(BOT_MARK)).toBe(true));
    expect(new Set(bots.map((b) => b.nickname)).size).toBe(2);
    expect(countRoles(Object.values(update.roles))).toEqual(countRoles(getCompositionForCount(5)));
  });

  it('drops bots left over from the last game', async () => {
    const leftover = { id: 'bot-0', nickname: 'Old Tom 🤖', isAlive: false, isBot: true };
    const update = await start([...humans(4), leftover], { botCount: 1 });
    expect(update.players.filter((p) => p.isBot)).toHaveLength(1);
    expect(update.players.find((p) => p.isBot).isAlive).toBe(true);
  });

  it('bots only ever play werewolf or villager', async () => {
    for (let i = 0; i < 50; i++) {
      const update = await start(humans(4), { botCount: 2 });
      expect([ROLE.WEREWOLF, ROLE.VILLAGER]).toContain(update.roles['bot-0']);
      expect([ROLE.WEREWOLF, ROLE.VILLAGER]).toContain(update.roles['bot-1']);
    }
  });

  it('a human can still be dealt a werewolf', async () => {
    let humanWolf = false;
    for (let i = 0; i < 200 && !humanWolf; i++) {
      const update = await start(humans(4), { botCount: 2 });
      humanWolf = Object.entries(update.roles).some(([id, role]) => id.startsWith('h') && role === ROLE.WEREWOLF);
    }
    expect(humanWolf).toBe(true);
  });

  it('every seat, human or bot, is equally likely to be the werewolf', async () => {
    const runs = 600;
    let humanWolves = 0;
    for (let i = 0; i < runs; i++) {
      const update = await start(humans(4), { botCount: 2 });
      humanWolves += Object.entries(update.roles).filter(([id, role]) => id.startsWith('h') && role === ROLE.WEREWOLF).length;
    }
    const expected = 4 / 6;
    expect(Math.abs(humanWolves / runs - expected)).toBeLessThan(0.08);
  });

  it('moves a wolf to a bot when the humans are needed for the special roles', async () => {
    const composition = [ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.THIEF, ROLE.VILLAGER, ROLE.VILLAGER];
    for (let i = 0; i < 50; i++) {
      const update = await start(humans(3), { botCount: 3, composition });
      expect(countRoles(Object.values(update.roles))).toEqual(countRoles(composition));
      ['bot-0', 'bot-1', 'bot-2'].forEach((id) => expect([ROLE.WEREWOLF, ROLE.VILLAGER]).toContain(update.roles[id]));
    }
  });
});
