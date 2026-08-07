/* global process */
/**
 * CLI Utility to Seed / Create Administrator Accounts
 * Usage:
 *   ADMIN_EMAIL="admin@biet.edu.in" ADMIN_PASSWORD="SecurePassword123!" ADMIN_NAME="Super Admin" ADMIN_ROLE="super_admin" node scripts/createAdminUser.js
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
];

// Fallback check if using FIREBASE_ or VITE_FIREBASE_
const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

if (!apiKey || !projectId) {
  console.error('❌ Error: Firebase environment variables are missing.');
  console.error('Ensure VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID are set in .env');
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME || 'BIET Administrator';
const adminRole = process.env.ADMIN_ROLE || 'super_admin'; // 'super_admin' | 'admin' | 'read_only'

if (!adminEmail || !adminPassword) {
  console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
  console.error('Usage: ADMIN_EMAIL="admin@biet.edu.in" ADMIN_PASSWORD="Password123" node scripts/createAdminUser.js');
  process.exit(1);
}

const app = initializeApp({
  apiKey,
  authDomain: authDomain || `${projectId}.firebaseapp.com`,
  projectId,
});

const auth = getAuth(app);
const db = getFirestore(app);

async function provisionAdmin() {
  console.log(`🔒 Provisioning admin [${adminEmail}] with role [${adminRole}] in project [${projectId}]...`);
  let user;

  try {
    // Attempt sign in first if user already exists
    const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    user = cred.user;
    console.log(`ℹ️ Existing Firebase Auth user found: ${user.uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      console.log('🆕 Creating new Firebase Auth user...');
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      user = cred.user;
      console.log(`✅ Auth user created: ${user.uid}`);
    } else {
      console.error('❌ Auth error:', err.code, err.message);
      process.exit(1);
    }
  }

  // Create or update admins/{uid} document in Firestore
  const adminRef = doc(db, 'admins', user.uid);
  await setDoc(adminRef, {
    uid: user.uid,
    email: user.email.toLowerCase().trim(),
    name: adminName,
    role: adminRole,
    active: true,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    createdBy: 'CLI_SEED_SCRIPT',
  }, { merge: true });

  console.log(`🎉 SUCCESS: Admin account [${user.email}] is fully provisioned in 'admins' collection!`);
  console.log(`   UID:    ${user.uid}`);
  console.log(`   Role:   ${adminRole}`);
  console.log(`   Active: true`);
  process.exit(0);
}

provisionAdmin().catch(err => {
  console.error('❌ Provisioning failed:', err);
  process.exit(1);
});
