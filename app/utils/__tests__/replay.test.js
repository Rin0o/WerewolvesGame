import { replayRounds } from '../replay';
import { makeGame } from '../../game-logic/__tests__/helpers';

const TABLE = { will: 'werewolf', wren: 'werewolf', sam: 'seer', tom: 'seer', vic: 'villager', vera: 'villager' };

function game(history, events) {
  return makeGame(TABLE, { status: 'ended', history, events });
}

const texts = (round) => round.lines.map((l) => l.text);

describe('replayRounds', () => {
  it('puts each round\'s secrets first, then what the village was told, in order', () => {
    const { intro, rounds } = replayRounds(game(
      [
        { time: 'night', round: 2, act: 'wolf_vote', by: 'will', target: 'vic' },
        { time: 'night', round: 2, act: 'wolf_vote', by: 'wren', target: 'vic' },
        { time: 'night', round: 2, act: 'pack', target: 'vic' },
        { time: 'night', round: 2, act: 'seer', by: 'sam', target: 'wren', wolf: true },
        { time: 'day', round: 2, act: 'vote', ballot: 1, by: 'sam', target: 'wren' },
        { time: 'day', round: 2, act: 'vote', ballot: 1, by: 'vera', target: 'sam' },
        { time: 'day', round: 2, act: 'vote', ballot: 1, by: 'will', target: 'sam' },
      ],
      [
        'Game started with 6 players.',
        'Night 1: The werewolves lurked in the shadows, but did not strike.',
        'Night 2: Vic was eliminated by the werewolves.',
        'Day 2: Sam was lynched by village vote (2 votes). Role: Seer',
        'The Hunter\'s last shot took down someone.',
      ],
    ));
    expect(intro).toEqual(['Game started with 6 players.']);
    expect(rounds.map((r) => r.title)).toEqual(['Night 1', 'Night 2', 'Day 2']);
    expect(rounds[1].lines).toEqual([
      { text: 'The pack voted: Vic (2: Will, Wren).', secret: true },
      { text: 'The pack chose Vic.', secret: true },
      { text: 'Sam (Seer) looked at Wren: a Werewolf.', secret: true },
      { text: 'Vic was eliminated by the werewolves.', secret: false },
    ]);
    expect(texts(rounds[2])).toEqual([
      'Votes: Sam (2: Vera, Will) · Wren (1: Sam).',
      'Sam was lynched by village vote (2 votes). Role: Seer',
      'The Hunter\'s last shot took down someone.',
    ]);
  });

  it('shows a revote as its own line', () => {
    const { rounds } = replayRounds(game([
      { time: 'day', round: 1, act: 'vote', ballot: 1, by: 'sam', target: 'will' },
      { time: 'day', round: 1, act: 'vote', ballot: 2, by: 'sam', target: 'wren' },
    ], []));
    expect(texts(rounds[0])).toEqual(['Votes: Will (1: Sam).', 'Revote: Wren (1: Sam).']);
  });

  it('names a role whose player is unknown, and lists the Fox\'s group', () => {
    const { rounds } = replayRounds(game([
      { time: 'night', round: 1, act: 'thief', by: 'tom', role: 'seer' },
      { time: 'night', round: 3, act: 'raven', by: null, target: 'vic' },
      { time: 'night', round: 3, act: 'fox', by: 'vera', target: 'vic', targets: ['sam', 'vic', 'vera'], wolf: false },
    ], []));
    expect(texts(rounds[0])).toEqual(['Tom (Thief) stole the Seer card.']);
    expect(texts(rounds[1])).toEqual([
      'The Raven marked Vic.',
      'Vera (Fox) sniffed Sam, Vic and Vera: no Werewolf.',
    ]);
  });

  it('works for a game from before the history existed', () => {
    const { rounds } = replayRounds(makeGame(TABLE, { events: ['Night 1: Vic was eliminated by the werewolves.'] }));
    expect(rounds).toEqual([{ key: 'night-1', title: 'Night 1', lines: [{ text: 'Vic was eliminated by the werewolves.', secret: false }] }]);
  });
});
