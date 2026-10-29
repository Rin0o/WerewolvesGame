import { publicDawnNews, privateDawnNews, dawnSummary } from '../dawnReport';
import { makeGame } from '../../game-logic/__tests__/helpers';

const TABLE = {
  will: 'werewolf',
  bea: 'bear_tamer',
  ed: 'elder',
  sam: 'seer',
  vic: 'villager',
  vera: 'villager',
};

function dawn(overrides = {}) {
  return makeGame(TABLE, { status: 'day', phase: 3, eliminatedThisNight: [], bearTamerGrowl: null, ...overrides });
}

const keys = (news) => news.map((n) => n.key);

describe('publicDawnNews', () => {
  it('announces each death with the role name and its team', () => {
    const [death] = publicDawnNews(dawn({ eliminatedThisNight: ['sam'], dead: ['sam'] }));
    expect(death.title).toBe('Sam was found dead');
    expect(death.detail).toBe('They were the Seer.');
    expect(death.team).toBe('villagers');
  });

  it('shows only the original role of a dead infected player, so the bite stays secret', () => {
    const [death] = publicDawnNews(dawn({ eliminatedThisNight: ['sam'], dead: ['sam'], infectedId: 'sam' }));
    expect(death.detail).toBe('They were the Seer.');
    expect(death.team).toBe('villagers');
  });

  it('drops the raven\'s mark once the village has lost its powers', () => {
    expect(keys(publicDawnNews(dawn({ ravenMark: 'vic', villagePowersLost: true })))).not.toContain('raven');
  });

  it('calls a night without deaths peaceful', () => {
    expect(keys(publicDawnNews(dawn()))).toEqual(['peaceful']);
  });

  it('adds the growl, then the raven\'s mark', () => {
    expect(keys(publicDawnNews(dawn({ bearTamerGrowl: true, ravenMark: 'vic' })))).toEqual(['peaceful', 'growl', 'raven']);
  });

  it('announces the dead Elder', () => {
    expect(keys(publicDawnNews(dawn({ villagePowersLost: true, dead: ['ed'] })))).toEqual(['peaceful', 'elder']);
  });

  it('drops the raven\'s mark on a dead player', () => {
    expect(keys(publicDawnNews(dawn({ ravenMark: 'vic', dead: ['vic'] })))).not.toContain('raven');
  });

  it('never mentions a silent Bear Tamer', () => {
    expect(keys(publicDawnNews(dawn({ bearTamerGrowl: false })))).toEqual(['peaceful']);
  });
});

describe('privateDawnNews', () => {
  it('tells only the Bear Tamer what the bears did', () => {
    const room = dawn({ bearTamerGrowl: false });
    expect(keys(privateDawnNews(room, 'bea'))).toEqual(['bears']);
    expect(privateDawnNews(room, 'vic')).toEqual([]);
  });

  it('tells only the Elder they survived, and only on that day', () => {
    expect(keys(privateDawnNews(dawn({ elderWoundedNight: 3 }), 'ed'))).toEqual(['elder-survived']);
    expect(privateDawnNews(dawn({ elderWoundedNight: 3 }), 'will')).toEqual([]);
    expect(privateDawnNews(dawn({ elderWoundedNight: 2 }), 'ed')).toEqual([]);
  });

  it('reminds each lover of the other, and nobody else', () => {
    const room = dawn({ lovers: ['vic', 'will'] });
    expect(privateDawnNews(room, 'vic')[0].detail).toContain('Your lover is Will.');
    expect(privateDawnNews(room, 'will')[0].detail).toContain('Your lover is Vic.');
    expect(privateDawnNews(room, 'sam')).toEqual([]);
  });

  it('tells a silenced villager their power is gone, not a plain villager', () => {
    const room = dawn({ villagePowersLost: true, dead: ['ed'] });
    expect(keys(privateDawnNews(room, 'sam'))).toEqual(['power-lost']);
    expect(privateDawnNews(room, 'vic')).toEqual([]);
  });

  it('shows nothing to the dead or the narrator', () => {
    const room = dawn({ bearTamerGrowl: true, dead: ['bea'] });
    expect(privateDawnNews(room, 'bea')).toEqual([]);
    const withNarrator = { ...room, players: [...room.players, { id: 'nar', nickname: 'Nar', isAlive: true, isNarrator: true }] };
    expect(privateDawnNews(withNarrator, 'nar')).toEqual([]);
  });
});

describe('dawnSummary', () => {
  it('folds the public news into one line and counts the private ones', () => {
    const news = publicDawnNews(dawn({ eliminatedThisNight: ['sam'], dead: ['sam'], ravenMark: 'vic' }));
    expect(dawnSummary(news, 1)).toBe('☠ Sam · 🐦‍⬛ Vic +2 · 👁 1 for you');
  });
});
