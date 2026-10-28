import { botVoteTarget, botDayChatter, botVoteLine, botWolfLine } from '../botChat';
import { BOT_LINES } from '../../constants/botLines';
import { makeGame } from './helpers';

const TABLE = { 'bot-0': 'villager', 'bot-1': 'werewolf', will: 'werewolf', vic: 'villager', vera: 'villager' };
const always = (value) => () => value;

describe('botVoteTarget', () => {
  it('a bot never votes for itself or for a dead player', () => {
    const room = makeGame(TABLE, { status: 'day', dead: ['vic'] });
    for (let i = 0; i < 50; i++) {
      expect(['bot-1', 'will', 'vera']).toContain(botVoteTarget(room, 'bot-0'));
    }
  });

  it('a wolf bot never votes against its own pack', () => {
    const room = makeGame(TABLE, { status: 'day' });
    for (let i = 0; i < 50; i++) {
      expect(['bot-0', 'vic', 'vera']).toContain(botVoteTarget(room, 'bot-1'));
    }
  });

  it('during a tie revote it only picks the tied players', () => {
    const room = makeGame(TABLE, { status: 'day', revoteTargets: ['vic', 'will'] });
    for (let i = 0; i < 50; i++) {
      expect(['vic', 'will']).toContain(botVoteTarget(room, 'bot-0'));
    }
  });

  it('in a revote, a wolf bot spares its packmate when it can', () => {
    const room = makeGame(TABLE, { status: 'day', revoteTargets: ['will', 'vic'] });
    for (let i = 0; i < 20; i++) expect(botVoteTarget(room, 'bot-1')).toBe('vic');
  });

  it('in a revote between wolves only, a wolf bot still votes within the revote', () => {
    const room = makeGame({ ...TABLE, vic: 'werewolf' }, { status: 'day', revoteTargets: ['will', 'vic'] });
    for (let i = 0; i < 20; i++) expect(['will', 'vic']).toContain(botVoteTarget(room, 'bot-1'));
  });

  it('never wastes a vote on the revealed Village Idiot', () => {
    const room = makeGame({ ...TABLE, vic: 'village_idiot' }, { status: 'day', idiotRevealed: 'vic' });
    for (let i = 0; i < 20; i++) expect(botVoteTarget(room, 'bot-0')).not.toBe('vic');
  });

  it('votes for the revealed Idiot only when nobody else can be chosen', () => {
    const room = makeGame({ ...TABLE, vic: 'village_idiot' }, { status: 'day', idiotRevealed: 'vic', revoteTargets: ['vic', 'bot-0'] });
    expect(botVoteTarget(room, 'bot-0')).toBe('vic');
  });
});

describe('bot day chatter', () => {
  it('mourns last night\'s victim by name and talks about the bot\'s own target', () => {
    const room = makeGame(TABLE, { status: 'day', dead: ['vera'], eliminatedThisNight: ['vera'] });
    const lines = botDayChatter(room, 'bot-0', 'vic', always(0));
    expect(lines).toEqual([
      BOT_LINES.dawnDeath[0].replace('{name}', 'Vera'),
      BOT_LINES.suspicion[0].replace('{name}', 'Vic'),
    ]);
  });

  it('notes a peaceful night', () => {
    const room = makeGame(TABLE, { status: 'day', eliminatedThisNight: [] });
    expect(botDayChatter(room, 'bot-0', 'vic', always(0))[0]).toBe(BOT_LINES.dawnPeace[0]);
  });

  it('stays quiet sometimes', () => {
    const room = makeGame(TABLE, { status: 'day', eliminatedThisNight: [] });
    expect(botDayChatter(room, 'bot-0', 'vic', always(0.99))).toEqual([]);
  });

  it('says nothing extra during a revote, only its vote', () => {
    const room = makeGame(TABLE, { status: 'day', revoteTargets: ['vic', 'will'] });
    expect(botDayChatter(room, 'bot-0', 'vic', always(0))).toEqual([]);
    expect(botVoteLine(room, 'vic', always(0))).toBe(BOT_LINES.revote[0].replace('{name}', 'Vic'));
  });

  it('announces the same player it votes for', () => {
    const room = makeGame(TABLE, { status: 'day' });
    expect(botVoteLine(room, 'vera', always(0))).toBe(BOT_LINES.vote[0].replace('{name}', 'Vera'));
  });

  it('every line fits in a chat message', () => {
    Object.values(BOT_LINES).flat().forEach((line) => {
      expect(line.replace('{name}', 'X'.repeat(18)).length).toBeLessThanOrEqual(500);
    });
  });
});

describe('bot wolf chat', () => {
  it('proposes a victim, or agrees with the pack\'s choice', () => {
    const room = makeGame(TABLE, { status: 'night' });
    expect(botWolfLine(room, 'vic', false, always(0))).toBe(BOT_LINES.wolfPick[0].replace('{name}', 'Vic'));
    expect(botWolfLine(room, 'vic', true, always(0))).toBe(BOT_LINES.wolfAgree[0].replace('{name}', 'Vic'));
  });
});
