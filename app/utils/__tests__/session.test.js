jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { saveSession, loadSession, clearSession, screenForStatus } from '../session';

describe('screenForStatus', () => {
  it('sends a rejoining player to the screen for the room status', () => {
    expect(screenForStatus('lobby')).toBe('Lobby');
    expect(screenForStatus('night')).toBe('NightPhase');
    expect(screenForStatus('day')).toBe('DayPhase');
    expect(screenForStatus('ended')).toBe('GameOver');
  });

  it('has no screen for an unknown status', () => {
    expect(screenForStatus('closed')).toBeNull();
    expect(screenForStatus(undefined)).toBeNull();
  });
});

describe('saved session', () => {
  beforeEach(() => clearSession());

  it('keeps the room, player and name for Rejoin', async () => {
    await saveSession({ roomId: 'r1', playerId: 'p1', nickname: 'Ana' });
    expect(await loadSession()).toEqual({ roomId: 'r1', playerId: 'p1', nickname: 'Ana' });
  });

  it('is gone after leaving', async () => {
    await saveSession({ roomId: 'r1', playerId: 'p1', nickname: 'Ana' });
    await clearSession();
    expect(await loadSession()).toBeNull();
  });
});
