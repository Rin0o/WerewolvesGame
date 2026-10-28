jest.mock('../../firebase/roomService', () => ({}));
jest.mock('firebase/firestore', () => ({ arrayUnion: (...items) => ({ arrayUnion: items }) }));

import {
  subPhaseSeconds, discussionSecondsFor, advanceNightPlan, hostNightPlan, nightTimeoutPlan, narratorAdvancePlan,
  botWolvesToWake, botWolfMove, allDayVotesCast, votingDone, humansAllVoted, botsYetToVote, botMaySpeak, canVote,
  WOLF_REVOTE_SECONDS,
} from '../hostDecisions';
import { makeGame, votesFor } from './helpers';

const VILLAGE = {
  sal: 'saviour',
  will: 'werewolf',
  wolf: 'werewolf',
  wendy: 'witch',
  sam: 'seer',
  vic: 'villager',
  val: 'villager',
};
const BOTH_POTIONS = { wendy: { save: true, poison: true } };

function night(step, nightActions = {}, overrides = {}) {
  return makeGame(VILLAGE, { phase: 2, witchPotions: BOTH_POTIONS, nightSubPhase: step, nightActions, ...overrides });
}

function withBots(game, botIds) {
  return { ...game, players: game.players.map((p) => (botIds.includes(p.id) ? { ...p, isBot: true } : p)) };
}

describe('timers', () => {
  it('gives the observing wolves 15s on a quiet night 1 and 30s for a pack revote', () => {
    expect(subPhaseSeconds('werewolf', { phase: 1 })).toBe(15);
    expect(subPhaseSeconds('werewolf', { phase: 2, nightActions: { wolfRevoteTargets: ['vic', 'val'] } })).toBe(WOLF_REVOTE_SECONDS);
    expect(subPhaseSeconds('werewolf', { phase: 2, nightActions: {} })).toBe(45);
  });

  it('uses the per-role overrides and 45s otherwise', () => {
    expect(subPhaseSeconds('seer', { phase: 2 })).toBe(25);
    expect(subPhaseSeconds('wolf_hound', { phase: 1 })).toBe(15);
    expect(subPhaseSeconds('witch', { phase: 2 })).toBe(45);
  });

  it('gives 30s of discussion per living player, between 90s and 240s', () => {
    expect(discussionSecondsFor(2)).toBe(90);
    expect(discussionSecondsFor(5)).toBe(150);
    expect(discussionSecondsFor(12)).toBe(240);
  });
});

describe('hostNightPlan', () => {
  it('does nothing outside the night or once the night is done', () => {
    expect(hostNightPlan(null)).toBeNull();
    expect(hostNightPlan(night('saviour', {}, { status: 'day' }))).toBeNull();
    expect(hostNightPlan(night('done'))).toBeNull();
  });

  it('opens the first step when the night has none', () => {
    expect(hostNightPlan(night(undefined))).toEqual({ update: { nightSubPhase: 'saviour' } });
  });

  it('waits while the active role has not acted', () => {
    expect(hostNightPlan(night('saviour'))).toBeNull();
  });

  it('moves to the next step once the active role has acted', () => {
    expect(hostNightPlan(night('saviour', { saviour: 'vic' }))).toEqual({ update: { nightSubPhase: 'werewolf' } });
  });

  it('skips a step whose player left', () => {
    const plan = hostNightPlan(night('witch', {}, { disconnectedPlayers: ['wendy'] }));
    expect(plan).toEqual({ update: { nightSubPhase: 'seer' } });
  });

  it('resolves the night after the last step', () => {
    const room = night('seer', { seer: 'vic' });
    expect(hostNightPlan(room)).toEqual({ resolveNight: room });
  });

  it('settles the pack vote when every wolf agrees', () => {
    const plan = hostNightPlan(night('werewolf', { wolfVotes: { will: 'vic', wolf: 'vic' } }));
    expect(plan).toEqual({ update: { 'nightActions.werewolf': 'vic' } });
  });

  it('starts a pack revote on a tie', () => {
    const plan = hostNightPlan(night('werewolf', { wolfVotes: { will: 'vic', wolf: 'val' } }));
    expect(plan.update['nightActions.wolfVotes']).toEqual({});
    expect(plan.update['nightActions.wolfRevoteTargets'].sort()).toEqual(['val', 'vic']);
  });

  it('waits for the rest of the pack', () => {
    expect(hostNightPlan(night('werewolf', { wolfVotes: { will: 'vic' } }))).toBeNull();
  });

  it('waits for the wolves to look at each other on a quiet night 1', () => {
    expect(hostNightPlan(night('werewolf', {}, { phase: 1 }))).toBeNull();
  });

  it('applies the Thief swap when leaving the thief step', () => {
    const room = makeGame({ tom: 'thief', will: 'werewolf', vic: 'villager' }, {
      phase: 1, nightSubPhase: 'thief', nightActions: { thief: 'cupid' },
    });
    const { update } = hostNightPlan(room);
    expect(update.roles.tom).toBe('cupid');
    expect(update.nightSubPhase).toBe('cupid');
  });

  describe('in a narrator game', () => {
    const narrated = (step, actions, overrides) => night(step, actions, { gameMode: 'narrator', ...overrides });

    it('leaves advancing to the narrator', () => {
      expect(hostNightPlan(narrated(undefined))).toBeNull();
      expect(hostNightPlan(narrated('saviour', { saviour: 'vic' }))).toBeNull();
    });

    it('still ends the role reveal step', () => {
      const room = narrated('reveal', {}, { phase: 1, roleAcknowledged: Object.keys(VILLAGE) });
      expect(hostNightPlan(room)).toEqual({ update: { nightSubPhase: 'werewolf' } });
    });

    it('still settles the pack vote', () => {
      const plan = hostNightPlan(narrated('werewolf', { wolfVotes: { will: 'val', wolf: 'val' } }));
      expect(plan).toEqual({ update: { 'nightActions.werewolf': 'val' } });
    });
  });
});

describe('advanceNightPlan', () => {
  it('moves on even when the step is not done (Start anyway)', () => {
    const room = night('reveal', {}, { phase: 1, roleAcknowledged: [] });
    expect(advanceNightPlan(room)).toEqual({ update: { nightSubPhase: 'werewolf' } });
  });
});

describe('nightTimeoutPlan', () => {
  it('does nothing once the step is done', () => {
    expect(nightTimeoutPlan(night('saviour', { saviour: 'vic' }))).toBeNull();
    expect(nightTimeoutPlan(night('done'))).toBeNull();
  });

  it('marks the pack as having looked on a quiet night 1', () => {
    expect(nightTimeoutPlan(night('werewolf', {}, { phase: 1 }))).toEqual({ update: { 'nightActions.werewolfObserved': true } });
  });

  it('forces the pack outcome with the votes cast so far', () => {
    const plan = nightTimeoutPlan(night('werewolf', { wolfVotes: { will: 'sam' } }));
    expect(plan).toEqual({ update: { 'nightActions.werewolf': 'sam' } });
  });

  it('draws a victim outside the pack when no wolf voted', () => {
    const { update } = nightTimeoutPlan(night('werewolf'));
    expect(['sal', 'wendy', 'sam', 'vic', 'val']).toContain(update['nightActions.werewolf']);
  });

  it('picks a random role model for the Wild Child, never itself', () => {
    const room = makeGame({ kid: 'wild_child', will: 'werewolf', vic: 'villager' }, { phase: 1, nightSubPhase: 'wild_child' });
    expect(nightTimeoutPlan(room, () => 0)).toEqual({ update: { 'nightActions.wildChild': 'will' } });
    expect(nightTimeoutPlan(room, () => 0.99)).toEqual({ update: { 'nightActions.wildChild': 'vic' } });
  });

  it('lets the Fox stay hidden rather than risk its power', () => {
    expect(nightTimeoutPlan(night('fox'))).toEqual({ update: { 'nightActions.foxSkip': true } });
    expect(subPhaseSeconds('fox', { phase: 2 })).toBe(25);
  });

  it('defaults the Wolf Hound to the village and lets the White Wolf and the Witch pass', () => {
    expect(nightTimeoutPlan(night('wolf_hound'))).toEqual({ update: { 'nightActions.wolfHound': 'villager' } });
    expect(nightTimeoutPlan(night('white_wolf'))).toEqual({ update: { 'nightActions.whiteWolfSkip': true } });
    expect(nightTimeoutPlan(night('witch'))).toEqual({ update: { 'nightActions.witchSkip': true } });
  });

  it('never makes the Saviour protect themself', () => {
    expect(nightTimeoutPlan(night('saviour'))).toEqual({ update: { 'nightActions.saviour': 'will' } });
  });

  it('never makes the Saviour protect last night\'s player again', () => {
    const plan = nightTimeoutPlan(night('saviour', {}, { saviourLastProtected: 'will' }));
    expect(plan).toEqual({ update: { 'nightActions.saviour': 'wolf' } });
  });

  it('never makes the Seer inspect themself', () => {
    const room = makeGame({ sam: 'seer', will: 'werewolf', vic: 'villager' }, { nightSubPhase: 'seer' });
    expect(nightTimeoutPlan(room)).toEqual({ update: { 'nightActions.seer': 'will' } });
  });

  it('never picks the narrator', () => {
    const room = makeGame({ sam: 'seer', vic: 'villager' }, { nightSubPhase: 'seer' });
    const narrated = { ...room, players: [{ id: 'ned', isAlive: true, isNarrator: true }, ...room.players] };
    expect(nightTimeoutPlan(narrated)).toEqual({ update: { 'nightActions.seer': 'vic' } });
  });

  it('gives the Thief a role nobody was dealt', () => {
    const room = makeGame({ tom: 'thief', will: 'werewolf', vic: 'villager' }, { phase: 1, nightSubPhase: 'thief' });
    const { update } = nightTimeoutPlan(room);
    expect(['seer', 'witch', 'hunter', 'cupid']).toContain(update['nightActions.thief']);
  });

  it('makes Cupid pair the first two living players', () => {
    const room = makeGame({ cora: 'cupid', will: 'werewolf', vic: 'villager' }, { phase: 1, nightSubPhase: 'cupid', dead: ['cora'] });
    expect(nightTimeoutPlan(room)).toEqual({ update: { 'nightActions.cupid': ['will', 'vic'] } });
  });
});

describe('narratorAdvancePlan', () => {
  it('settles the pack vote and moves on in one write', () => {
    const plan = narratorAdvancePlan(night('werewolf', { wolfVotes: { will: 'vic' } }));
    expect(plan).toEqual({ update: { 'nightActions.werewolf': 'vic', nightSubPhase: 'witch' } });
  });

  it('stays on the step when the forced outcome is a revote', () => {
    const plan = narratorAdvancePlan(night('werewolf', { wolfVotes: { will: 'vic', wolf: 'val' } }));
    expect(plan.update.nightSubPhase).toBeUndefined();
    expect(plan.update['nightActions.wolfRevoteTargets'].sort()).toEqual(['val', 'vic']);
    expect(plan.resolveNight).toBeUndefined();
  });

  it('resolves with the victim when the pack was the last step', () => {
    const room = night('werewolf', { wolfVotes: { will: 'vic' } }, { dead: ['wendy', 'sam'] });
    const plan = narratorAdvancePlan(room);
    expect(plan.update).toEqual({ 'nightActions.werewolf': 'vic' });
    expect(plan.resolveNight.nightActions.werewolf).toBe('vic');
  });

  it('spares everyone after a second tie', () => {
    const room = night('werewolf', { wolfVotes: { will: 'vic', wolf: 'val' }, wolfRevoteTargets: ['vic', 'val'] });
    expect(narratorAdvancePlan(room)).toEqual({ update: { 'nightActions.wolfNoKill': true, nightSubPhase: 'witch' } });
  });

  it('just advances any other step', () => {
    expect(narratorAdvancePlan(night('saviour'))).toEqual({ update: { nightSubPhase: 'werewolf' } });
  });
});

describe('bot wolves', () => {
  it('wakes every living bot wolf while the pack is choosing', () => {
    const room = withBots(night('werewolf'), ['will', 'wolf', 'vic']);
    expect(botWolvesToWake(room).map((p) => p.id)).toEqual(['will', 'wolf']);
  });

  it('does not wake them once the pack has chosen', () => {
    const room = withBots(night('werewolf', { werewolf: 'vic' }), ['will']);
    expect(botWolvesToWake(room)).toEqual([]);
  });

  it('on a quiet night 1 lets one bot finish the look only when the whole pack is bots', () => {
    const allBots = withBots(night('werewolf', {}, { phase: 1 }), ['will', 'wolf']);
    expect(botWolvesToWake(allBots).map((p) => p.id)).toEqual(['will']);
    expect(botWolfMove(allBots, 'will')).toEqual({ observe: true });
    const mixed = withBots(night('werewolf', {}, { phase: 1 }), ['will']);
    expect(botWolvesToWake(mixed)).toEqual([]);
  });

  it('follows the pack\'s leading target', () => {
    const room = withBots(night('werewolf', { wolfVotes: { will: 'sam' } }), ['wolf']);
    expect(botWolfMove(room, 'wolf')).toEqual({ target: 'sam', followsLeader: true });
  });

  it('picks someone outside the pack when nobody has voted', () => {
    const room = withBots(night('werewolf'), ['wolf']);
    expect(botWolfMove(room, 'wolf', () => 0)).toEqual({ target: 'sal', followsLeader: false });
  });

  it('stays within a revote', () => {
    const room = withBots(night('werewolf', { wolfRevoteTargets: ['vic', 'val'], wolfVotes: {} }), ['wolf']);
    expect(['vic', 'val']).toContain(botWolfMove(room, 'wolf').target);
  });

  it('does not vote twice', () => {
    const room = withBots(night('werewolf', { wolfVotes: { wolf: 'vic' } }), ['wolf']);
    expect(botWolfMove(room, 'wolf')).toBeNull();
  });
});

describe('day voting', () => {
  const day = (overrides) => makeGame(VILLAGE, { status: 'day', ...overrides });
  const everyone = (target) => votesFor(Object.fromEntries(Object.keys(VILLAGE).map((id) => [id, target])));

  it('is done when every living player has voted, or the votes were closed', () => {
    expect(allDayVotesCast(day({ votes: everyone('vic') }))).toBe(true);
    expect(votingDone(day({ votes: votesFor({ vic: 'will' }) }))).toBe(false);
    expect(votingDone(day({ votesClosed: true }))).toBe(true);
  });

  it('does not wait for players who left or the narrator', () => {
    const { vic, ...others } = everyone('val');
    const room = day({ votes: others, disconnectedPlayers: ['vic'] });
    expect(allDayVotesCast(room)).toBe(true);
    const narrated = { ...room, players: [...room.players, { id: 'ned', isAlive: true, isNarrator: true }] };
    expect(allDayVotesCast(narrated)).toBe(true);
  });

  it('knows when only bots are left to vote', () => {
    const room = withBots(day({ votes: votesFor({ sal: 'will', will: 'vic', wolf: 'vic', wendy: 'will', sam: 'will' }) }), ['vic', 'val']);
    expect(humansAllVoted(room)).toBe(true);
    expect(botsYetToVote(room).map((p) => p.id)).toEqual(['vic', 'val']);
    expect(humansAllVoted(withBots(day(), ['vic']))).toBe(false);
  });

  it('a revealed Village Idiot no longer votes, and nobody waits for them', () => {
    const room = withBots(day({ idiotRevealed: 'vic' }), ['vic']);
    expect(canVote(room, 'vic')).toBe(false);
    expect(canVote(room, 'val')).toBe(true);
    expect(botsYetToVote(room).map((p) => p.id)).not.toContain('vic');
    const { vic, ...others } = everyone('val');
    expect(allDayVotesCast({ ...room, votes: others })).toBe(true);
  });

  it('keeps bots quiet once votes close', () => {
    expect(botsYetToVote(withBots(day({ votesClosed: true }), ['vic']))).toEqual([]);
  });

  it('lets a bot speak only while it is alive and the vote is open', () => {
    const room = withBots(day(), ['vic']);
    expect(botMaySpeak(room, 'vic')).toBe(true);
    expect(botMaySpeak({ ...room, votesClosed: true }, 'vic')).toBe(false);
    expect(botMaySpeak({ ...room, hunterTriggered: 'sal' }, 'vic')).toBe(false);
    expect(botMaySpeak(withBots(day({ dead: ['vic'] }), ['vic']), 'vic')).toBe(false);
  });
});
