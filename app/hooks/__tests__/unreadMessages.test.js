jest.mock('../../firebase/roomService', () => ({
  subscribeToDayChat: jest.fn(),
  subscribeToWerewolfChat: jest.fn(),
}));

import { seenSet, markSeen, unreadCount } from '../useUnreadMessages';

const message = (id, senderId) => ({ id, senderId, text: 'hi' });

describe('unread chat messages', () => {
  it('counts other players\' messages that have not been seen', () => {
    const messages = [message('m1', 'ana'), message('m2', 'bo')];
    expect(unreadCount(messages, 'me', new Set())).toBe(2);
  });

  it('never counts my own messages', () => {
    const messages = [message('m1', 'me'), message('m2', 'ana')];
    expect(unreadCount(messages, 'me', new Set())).toBe(1);
  });

  it('opening the chat clears the badge, and only newer messages count again', () => {
    const seen = new Set();
    const before = [message('m1', 'ana'), message('m2', 'bo')];
    markSeen(before, seen);
    expect(unreadCount(before, 'me', seen)).toBe(0);
    expect(unreadCount([...before, message('m3', 'ana')], 'me', seen)).toBe(1);
  });

  it('remembers what was seen per room and chat, across screens', () => {
    markSeen([message('m1', 'ana')], seenSet('room-1:day'));
    expect(seenSet('room-1:day').has('m1')).toBe(true);
    expect(seenSet('room-1:werewolf').has('m1')).toBe(false);
    expect(seenSet('room-2:day').has('m1')).toBe(false);
  });
});
