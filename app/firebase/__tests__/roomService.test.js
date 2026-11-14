jest.mock('../config', () => ({ db: 'db' }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'new-room' })),
  collection: jest.fn(() => 'rooms'),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'server-time'),
}));

import { setDoc } from 'firebase/firestore';
import { createRoom } from '../roomService';

beforeEach(() => jest.clearAllMocks());

describe('createRoom', () => {
  it('opens a lobby with the host as its only member', async () => {
    const { roomId, code } = await createRoom('host', 'Anna');
    expect(roomId).toBe('new-room');
    expect(code).toMatch(/^[A-Z0-9]{1,5}$/);
    expect(setDoc.mock.calls[0][1]).toMatchObject({
      code,
      hostId: 'host',
      status: 'lobby',
      memberIds: ['host'],
      players: [{ id: 'host', nickname: 'Anna', isHost: true, isReady: false }],
    });
  });

  it('starts with a Classic first night and a revote on ties', async () => {
    await createRoom('host', 'Anna');
    expect(setDoc.mock.calls[0][1]).toMatchObject({ classicFirstNight: true, tieRule: 'revote' });
  });
});
