import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Helper to check if config is still placeholders
const isConfigPlaceholder = 
  !firebaseConfig.apiKey || 
  firebaseConfig.apiKey.includes('PASTE_YOUR') || 
  firebaseConfig.apiKey === 'TODO_KEYHERE';

if (isConfigPlaceholder) {
  console.warn(
    'Firebase configuration contains placeholders. Please update /firebase-applet-config.json with valid credentials from the Firebase Console.'
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { isConfigPlaceholder };
