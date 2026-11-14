import fs from 'fs';
import path from 'path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, setLogLevel } from 'firebase/firestore';

let env;

function profileOf(uid) {
  const db = uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
  return doc(db, 'users', 'alice');
}

function profile(nickname = 'Alice', extra = {}) {
  return { nickname, updatedAt: serverTimestamp(), ...extra };
}

beforeAll(async () => {
  setLogLevel('error');
  env = await initializeTestEnvironment({
    projectId: 'demo-werewolves',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

async function seedAlice() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'alice'), { nickname: 'Alice', updatedAt: new Date() });
  });
}

describe('user profiles', () => {
  test('the owner saves and updates their name', async () => {
    await assertSucceeds(setDoc(profileOf('alice'), profile()));
    await assertSucceeds(setDoc(profileOf('alice'), profile('Alicia'), { merge: true }));
  });

  test('nobody else writes, reads or deletes it', async () => {
    await seedAlice();
    await assertFails(setDoc(profileOf('bob'), profile('Bob')));
    await assertFails(getDoc(profileOf('bob')));
    await assertFails(deleteDoc(profileOf('bob')));
    await assertFails(getDoc(profileOf(null)));
  });

  test('the owner reads and deletes it', async () => {
    await seedAlice();
    await assertSucceeds(getDoc(profileOf('alice')));
    await assertSucceeds(deleteDoc(profileOf('alice')));
  });

  test('the name follows the app rules', async () => {
    await assertFails(setDoc(profileOf('alice'), profile('A')));
    await assertFails(setDoc(profileOf('alice'), profile('A name that is far too long')));
    await assertFails(setDoc(profileOf('alice'), profile(42)));
  });

  test('only the name and the time are stored, and the time is the server time', async () => {
    await assertFails(setDoc(profileOf('alice'), profile('Alice', { email: 'alice@example.com' })));
    await assertFails(setDoc(profileOf('alice'), { nickname: 'Alice', updatedAt: new Date(0) }));
  });
});
