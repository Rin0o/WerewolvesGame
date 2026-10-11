import { useState, useEffect } from 'react';
import { subscribeToRoom } from '../firebase/roomService';

const lastSnapshotByRoom = new Map();

export function forgetRoomSnapshot(roomId) {
  lastSnapshotByRoom.delete(roomId);
}

/**
 * Subscribes to a Firestore room document in real-time.
 * Returns { room, loading, error }.
 */
export default function useRoom(roomId) {
  const [room, setRoom] = useState(() => lastSnapshotByRoom.get(roomId) || null);
  const [loading, setLoading] = useState(() => !!roomId && !lastSnapshotByRoom.has(roomId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const cached = lastSnapshotByRoom.get(roomId);
    setRoom(cached || null);
    setLoading(!cached);
    const unsubscribe = subscribeToRoom(roomId, (data) => {
      lastSnapshotByRoom.set(roomId, data);
      setRoom(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  return { room, loading, error };
}
