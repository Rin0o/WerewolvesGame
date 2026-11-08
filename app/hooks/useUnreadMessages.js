import { useEffect, useState } from 'react';
import { subscribeToDayChat, subscribeToWerewolfChat, subscribeToSisterChat } from '../firebase/roomService';

const SUBSCRIBERS = {
  day: subscribeToDayChat,
  werewolf: subscribeToWerewolfChat,
  sister: subscribeToSisterChat,
};

const seenByChat = new Map();

export function seenSet(key) {
  if (!seenByChat.has(key)) seenByChat.set(key, new Set());
  return seenByChat.get(key);
}

export function markSeen(messages, seen) {
  messages.forEach((m) => seen.add(m.id));
}

export function unreadCount(messages, playerId, seen) {
  return messages.filter((m) => m.senderId !== playerId && !seen.has(m.id)).length;
}

export default function useUnreadMessages(roomId, chat, playerId, { isOpen, enabled = true }) {
  const [messages, setMessages] = useState([]);
  const seen = seenSet(`${roomId}:${chat}`);

  useEffect(() => {
    if (!roomId || !enabled) return undefined;
    return SUBSCRIBERS[chat](roomId, setMessages);
  }, [roomId, chat, enabled]);

  if (isOpen) markSeen(messages, seen);
  return enabled ? unreadCount(messages, playerId, seen) : 0;
}
