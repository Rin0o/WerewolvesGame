import { useState, useEffect } from 'react';
import { subscribeToRoom } from '../firebase/roomService';

/**
 * Subscribes to a Firestore room document in real-time.
 * Returns { room, loading, error }.
 */
export default function useRoom(roomId) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToRoom(roomId, (data) => {
      setRoom(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  return { room, loading, error };
}
