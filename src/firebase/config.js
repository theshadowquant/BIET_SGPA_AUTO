/**
 * Firebase Configuration
 * All values loaded from environment variables — never hardcode credentials.
 * Copy .env.example to .env and fill in your Firebase project values.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? '',
};

// Warn about missing config (non-blocking — app still renders)
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredKeys.filter(k => !firebaseConfig[k]);
if (missingKeys.length > 0) {
  console.warn(
    `[Firebase] Missing env vars: ${missingKeys.join(', ')}. ` +
    'Copy .env.example to .env and add your Firebase project credentials. ' +
    'The UI will render but Firebase features will not work until configured.'
  );
}

let app, db, auth;

try {
  app  = initializeApp(firebaseConfig);
  db   = getFirestore(app);
  auth = getAuth(app);
} catch (err) {
  console.error('[Firebase] Initialization failed:', err.message);
  // Export stubs so imports don't crash the module graph
  app  = null;
  db   = null;
  auth = null;
}

export { db, auth };
export default app;

