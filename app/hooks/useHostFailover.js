import { useEffect, useRef } from 'react';
import { beatHost, takeOverHost } from '../firebase/roomService';

const HEARTBEAT_MS = 8000;
const STALE_AFTER_MS = 25000;
const STAGGER_MS = 6000;
const CHECK_EVERY_MS = 2000;

function takeoverCandidates(room) {
  const disconnected = room.disconnectedPlayers || [];
  return (room.players || []).filter(
    (p) => !p.isBot && !p.isNarrator && p.id !== room.hostId && !disconnected.includes(p.id)
  );
}

function failoverAllowed(room) {
  return !(room.gameMode === 'narrator' && room.status !== 'lobby');
}

export default function useHostFailover(roomId, playerId, room) {
  const roomRef = useRef(room);
  roomRef.current = room;
  const lastBeatRef = useRef({ hostId: undefined, beat: undefined, seenAt: Date.now() });
  const takingOverRef = useRef(false);

  const hostId = room?.hostId;
  const beat = room?.hostHeartbeat;
  const isHost = !!room && hostId === playerId;

  useEffect(() => {
    lastBeatRef.current = { hostId, beat, seenAt: Date.now() };
  }, [hostId, beat]);

  useEffect(() => {
    if (!isHost || !roomId) return;
    beatHost(roomId).catch(() => {});
    const interval = setInterval(() => beatHost(roomId).catch(() => {}), HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [isHost, roomId]);

  useEffect(() => {
    if (!roomId || !playerId) return;
    const interval = setInterval(() => {
      const current = roomRef.current;
      if (!current || takingOverRef.current) return;
      if (current.hostId === playerId || !failoverAllowed(current)) return;

      const rank = takeoverCandidates(current).findIndex((p) => p.id === playerId);
      if (rank === -1) return;

      const { hostId: seenHostId, beat: seenBeat, seenAt } = lastBeatRef.current;
      if (seenHostId !== current.hostId) return;
      if (Date.now() - seenAt < STALE_AFTER_MS + rank * STAGGER_MS) return;

      takingOverRef.current = true;
      takeOverHost(roomId, seenHostId, seenBeat, playerId)
        .catch(() => {})
        .finally(() => {
          takingOverRef.current = false;
          lastBeatRef.current = { ...lastBeatRef.current, seenAt: Date.now() };
        });
    }, CHECK_EVERY_MS);
    return () => clearInterval(interval);
  }, [roomId, playerId]);
}
