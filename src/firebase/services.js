/**
 * Firebase Services Layer — Optimized
 *
 * Performance notes:
 * - Analytics: single doc read + real-time listener (never scans collection)
 * - Visitor count: stored in analytics/global via increment (no collection scan)
 * - Pagination: cursor-based, 20/page, never loads full collection
 * - All queries have explicit 8-second timeouts to prevent UI hangs
 * - avgSGPA is DERIVED: sgpaSum / totalCalculations (never stored directly)
 */

import {
  collection, doc, addDoc, getDoc, setDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, getDocs,
  writeBatch, serverTimestamp, increment, onSnapshot,
} from 'firebase/firestore';
import { db } from './config';

const RESULTS_COL   = 'results';
const ANALYTICS_DOC = 'analytics/global';
const VISITS_COL    = 'visits';
const PAGE_SIZE     = 20;

// ─── Timeout helper ───────────────────────────────────────────────────────────
function withTimeout(promise, ms = 8000, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─── Save Result ─────────────────────────────────────────────────────────────
export async function saveResult({ name, usn, sgpa, subjects }) {
  if (!db) throw new Error('Firebase not initialized — check .env file');

  const batch = writeBatch(db);

  const resultRef = doc(collection(db, RESULTS_COL));
  batch.set(resultRef, {
    name: name.trim(),
    usn:  usn.toUpperCase().trim(),
    sgpa: parseFloat(sgpa),
    subjects,
    timestamp: serverTimestamp(),
  });

  // Atomic increment — avgSGPA is derived, never stored directly
  const analyticsRef = doc(db, ANALYTICS_DOC);
  batch.set(analyticsRef, {
    totalCalculations: increment(1),
    sgpaSum:           increment(parseFloat(sgpa)),
  }, { merge: true });

  await batch.commit();
  return resultRef.id;
}

// ─── Get Results by USN ───────────────────────────────────────────────────────
export async function getResultsByUSN(usn, maxResults = 5) {
  if (!db) return [];
  const q = query(
    collection(db, RESULTS_COL),
    where('usn', '==', usn.toUpperCase().trim()),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );
  const snap = await withTimeout(getDocs(q), 6000, null);
  if (!snap) return [];
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Paginated Results (admin) ────────────────────────────────────────────────
export async function getPaginatedResults({ lastDoc = null, usnFilter = '', sgpaMin = null, sgpaMax = null } = {}) {
  if (!db) return { docs: [], lastDoc: null, hasMore: false };

  let q;

  if (usnFilter) {
    q = query(
      collection(db, RESULTS_COL),
      where('usn', '==', usnFilter.toUpperCase().trim()),
      orderBy('timestamp', 'desc'),
      limit(PAGE_SIZE)
    );
  } else if (sgpaMin !== null && sgpaMax !== null) {
    q = query(
      collection(db, RESULTS_COL),
      where('sgpa', '>=', parseFloat(sgpaMin)),
      where('sgpa', '<=', parseFloat(sgpaMax)),
      orderBy('sgpa', 'asc'),
      ...(lastDoc ? [startAfter(lastDoc)] : []),
      limit(PAGE_SIZE)
    );
  } else {
    q = query(
      collection(db, RESULTS_COL),
      orderBy('timestamp', 'desc'),
      ...(lastDoc ? [startAfter(lastDoc)] : []),
      limit(PAGE_SIZE)
    );
  }

  const snap = await withTimeout(getDocs(q), 10000, null);
  if (!snap) throw new Error('Query timed out — check Firestore indexes and rules');

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { docs, lastDoc: snap.docs[snap.docs.length - 1] ?? null, hasMore: snap.docs.length === PAGE_SIZE };
}

// ─── Delete Result ─────────────────────────────────────────────────────────────
export async function deleteResult(id) {
  if (!db) throw new Error('Firebase not initialized');
  const resultSnap = await getDoc(doc(db, RESULTS_COL, id));
  if (resultSnap.exists()) {
    const sgpa = resultSnap.data().sgpa;
    const batch = writeBatch(db);
    batch.delete(doc(db, RESULTS_COL, id));
    batch.set(doc(db, ANALYTICS_DOC), {
      totalCalculations: increment(-1),
      sgpaSum: increment(-parseFloat(sgpa)),
    }, { merge: true });
    await batch.commit();
  } else {
    await deleteDoc(doc(db, RESULTS_COL, id));
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getAnalytics() {
  if (!db) return { totalCalculations: 0, sgpaSum: 0, avgSGPA: 0, totalVisitors: 0 };
  const snap = await withTimeout(getDoc(doc(db, ANALYTICS_DOC)), 5000, null);
  if (!snap || !snap.exists()) return { totalCalculations: 0, sgpaSum: 0, avgSGPA: 0, totalVisitors: 0 };
  const { totalCalculations = 0, sgpaSum = 0, totalVisitors = 0 } = snap.data();
  return {
    totalCalculations,
    sgpaSum,
    totalVisitors,
    avgSGPA: totalCalculations > 0 ? parseFloat((sgpaSum / totalCalculations).toFixed(2)) : 0,
  };
}

// Real-time listener — single doc, never scans collection
export function subscribeToAnalytics(callback) {
  if (!db) { callback({ totalCalculations: 0, sgpaSum: 0, avgSGPA: 0, totalVisitors: 0 }); return () => {}; }
  return onSnapshot(
    doc(db, ANALYTICS_DOC),
    (snap) => {
      if (!snap.exists()) { callback({ totalCalculations: 0, sgpaSum: 0, avgSGPA: 0, totalVisitors: 0 }); return; }
      const { totalCalculations = 0, sgpaSum = 0, totalVisitors = 0 } = snap.data();
      callback({
        totalCalculations,
        sgpaSum,
        totalVisitors,
        avgSGPA: totalCalculations > 0 ? parseFloat((sgpaSum / totalCalculations).toFixed(2)) : 0,
      });
    },
    (err) => {
      console.error('[Analytics listener]', err.code, err.message);
      callback({ totalCalculations: 0, sgpaSum: 0, avgSGPA: 0, totalVisitors: 0 });
    }
  );
}

// ─── Visit Tracking ───────────────────────────────────────────────────────────
export async function recordVisit(sessionId, deviceInfo) {
  if (!db) return false;
  try {
    const batch = writeBatch(db);

    // 1. Create visit document (sessionId as doc ID — prevents duplicate)
    batch.set(doc(db, VISITS_COL, sessionId), {
      sessionId,
      createdAt:  serverTimestamp(),
      lastActive: serverTimestamp(),
      deviceInfo: {
        userAgent: (deviceInfo.userAgent ?? '').slice(0, 150),
        platform:  deviceInfo.platform ?? 'unknown',
        language:  deviceInfo.language ?? 'unknown',
      },
    }, { merge: false });

    // 2. Increment visitor counter in analytics (so getVisitorCount is O(1))
    batch.set(doc(db, ANALYTICS_DOC), {
      totalVisitors: increment(1),
    }, { merge: true });

    await batch.commit();
    return true;
  } catch (err) {
    // Silent — visit tracking must never block user flow
    console.warn('[Visit]', err.code ?? err.message);
    return false;
  }
}

// Fast visitor count — reads from analytics doc (single read, O(1))
export async function getVisitorCount() {
  if (!db) return 0;
  const snap = await withTimeout(getDoc(doc(db, ANALYTICS_DOC)), 5000, null);
  if (!snap || !snap.exists()) return 0;
  return snap.data().totalVisitors ?? 0;
}

// ─── SGPA Distribution for chart ─────────────────────────────────────────────
export async function getSGPADistribution() {
  if (!db) return [];
  const q = query(collection(db, RESULTS_COL), orderBy('timestamp', 'desc'), limit(200));
  const snap = await withTimeout(getDocs(q), 8000, null);
  if (!snap) return [];

  const buckets = { '< 6.0': 0, '6.0–6.9': 0, '7.0–7.9': 0, '8.0–8.9': 0, '9.0–10': 0 };
  snap.docs.forEach(d => {
    const s = d.data().sgpa;
    if      (s < 6)  buckets['< 6.0']++;
    else if (s < 7)  buckets['6.0–6.9']++;
    else if (s < 8)  buckets['7.0–7.9']++;
    else if (s < 9)  buckets['8.0–8.9']++;
    else             buckets['9.0–10']++;
  });
  return Object.entries(buckets).map(([range, count]) => ({ range, count }));
}

// ─── Daily Usage for chart ────────────────────────────────────────────────────
export async function getDailyUsage() {
  if (!db) return [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Simple query: just timestamp desc, no compound filter (avoids index requirement)
  const q = query(collection(db, RESULTS_COL), orderBy('timestamp', 'desc'), limit(500));
  const snap = await withTimeout(getDocs(q), 8000, null);
  if (!snap) return [];

  const dayCounts = {};
  snap.docs.forEach(d => {
    const ts = d.data().timestamp?.toDate?.() ?? new Date();
    if (ts < sevenDaysAgo) return;
    const key = ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    dayCounts[key] = (dayCounts[key] ?? 0) + 1;
  });

  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    result.push({ date: key, count: dayCounts[key] ?? 0 });
  }
  return result;
}
