import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  serverTimestamp,
  writeBatch,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './config';

export const GAMES_PAGE_SIZE = 20;
const BATCH_LIMIT = 400;

const gamesCollection = () => collection(db, 'games');

export async function saveMatchRecord(id, record) {
  await setDoc(doc(db, 'games', id), { ...record, endedAt: serverTimestamp() });
}

export async function loadMyGames(uid, after = null) {
  const constraints = [where('playerIds', 'array-contains', uid), orderBy('endedAt', 'desc')];
  if (after) constraints.push(startAfter(after));
  constraints.push(limit(GAMES_PAGE_SIZE));
  const snapshot = await getDocs(query(gamesCollection(), ...constraints));
  return {
    games: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
    last: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: snapshot.docs.length === GAMES_PAGE_SIZE,
  };
}

export async function countMyGames(uid) {
  const [played, won, narrated] = await Promise.all([
    getCountFromServer(query(gamesCollection(), where('playerIds', 'array-contains', uid))),
    getCountFromServer(query(gamesCollection(), where('winnerIds', 'array-contains', uid))),
    getCountFromServer(query(gamesCollection(), where('narratorId', '==', uid))),
  ]);
  return { played: played.data().count, won: won.data().count, narrated: narrated.data().count };
}

export async function forgetMyGames(uid) {
  const snapshot = await getDocs(query(gamesCollection(), where('playerIds', 'array-contains', uid)));
  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    snapshot.docs.slice(i, i + BATCH_LIMIT).forEach((d) => {
      batch.update(d.ref, {
        playerIds: arrayRemove(uid),
        winnerIds: arrayRemove(uid),
        ...(d.data().narratorId === uid ? { narratorId: null } : {}),
      });
    });
    await batch.commit();
  }
}
