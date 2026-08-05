/*
 * One-time legacy-data migration.
 *
 * Firestore excludes documents that do not contain an orderBy field. This
 * script gives legacy result documents a timestamp equal to their Firestore
 * creation time, so they participate in every dashboard query without moving
 * them to the present. It only updates documents with a missing/invalid field.
 *
 * Run with authenticated Firebase web configuration supplied through process
 * environment variables; no credential is stored in this repository.
 */
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
  getFirestore, collection, query, orderBy, documentId, startAfter,
  limit, getDocs, writeBatch,
} = require('firebase/firestore');

const required = [
  'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID',
  'ADMIN_EMAIL', 'ADMIN_PASSWORD',
];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);

const PAGE_SIZE = 250;
const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
});

async function migrate() {
  await signInWithEmailAndPassword(getAuth(app), process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const db = getFirestore(app);
  let cursor = null;
  let updated = 0;

  do {
    const constraints = [orderBy(documentId()), limit(PAGE_SIZE)];
    if (cursor) constraints.splice(1, 0, startAfter(cursor));
    const snap = await getDocs(query(collection(db, 'results'), ...constraints));
    if (snap.empty) break;

    const batch = writeBatch(db);
    let writes = 0;
    snap.docs.forEach(result => {
      if (!result.data().timestamp?.toDate && result.createTime) {
        batch.update(result.ref, { timestamp: result.createTime });
        writes += 1;
      }
    });
    if (writes) {
      await batch.commit();
      updated += writes;
    }
    cursor = snap.docs[snap.docs.length - 1];
    console.log(`Scanned ${snap.size} documents; backfilled ${updated}.`);
    if (snap.size < PAGE_SIZE) break;
  } while (cursor);

  console.log(`Done. Backfilled ${updated} legacy result timestamps.`);
}

migrate().catch(error => {
  console.error('Timestamp migration failed:', error.code ?? error.message);
  process.exitCode = 1;
});
