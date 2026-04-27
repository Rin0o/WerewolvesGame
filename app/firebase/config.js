import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCrSB6mQaVRd6b8wUuApMcz1Qu2HDzgYDA",
  authDomain: "werewolvesgame-46ba0.firebaseapp.com",
  projectId: "werewolvesgame-46ba0",
  storageBucket: "werewolvesgame-46ba0.firebasestorage.app",
  messagingSenderId: "533863907492",
  appId: "1:533863907492:web:27f48a2475745f717ea631",
  measurementId: "G-M4EX2MZK3R"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export default app;