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
export async function saveResult({ name, usn, branch, semester, sgpa, subjects }) {
  if (!db) throw new Error('Firebase not initialized — check .env file');

  const batch = writeBatch(db);

  const resultRef = doc(collection(db, RESULTS_COL));
  batch.set(resultRef, {
    name: name.trim(),
    usn:  usn.toUpperCase().trim(),
    branch: branch || 'cs-ds',
    semester: Number(semester || 4),
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

// ─── Paginated Results (admin with client-side filter fallback) ───────────────
export async function getPaginatedResults({ lastDoc = null, usnFilter = '', sgpaMin = null, sgpaMax = null, branchFilter = '', semesterFilter = null } = {}) {
  if (!db) return { docs: [], lastDoc: null, hasMore: false };

  // If we have branch or semester filters, we fetch the latest 500 records and filter client-side
  // to avoid requiring compound index setups on the client's Firebase project.
  if (branchFilter || (semesterFilter !== null && semesterFilter !== '')) {
    const q = query(
      collection(db, RESULTS_COL),
      orderBy('timestamp', 'desc'),
      limit(500)
    );
    const snap = await withTimeout(getDocs(q), 10000, null);
    if (!snap) return { docs: [], lastDoc: null, hasMore: false };

    let filtered = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (usnFilter) {
      filtered = filtered.filter(r => r.usn.includes(usnFilter.toUpperCase().trim()));
    }
    if (branchFilter) {
      filtered = filtered.filter(r => r.branch === branchFilter);
    }
    if (semesterFilter !== null && semesterFilter !== '') {
      filtered = filtered.filter(r => Number(r.semester) === Number(semesterFilter));
    }
    if (sgpaMin !== null && sgpaMin !== '') {
      filtered = filtered.filter(r => r.sgpa >= parseFloat(sgpaMin));
    }
    if (sgpaMax !== null && sgpaMax !== '') {
      filtered = filtered.filter(r => r.sgpa <= parseFloat(sgpaMax));
    }

    // Handle memory pagination
    const startIndex = lastDoc ? filtered.findIndex(r => r.id === lastDoc.id) + 1 : 0;
    const paginated = filtered.slice(startIndex, startIndex + PAGE_SIZE);
    const lastPaginatedDoc = paginated[paginated.length - 1] ? { id: paginated[paginated.length - 1].id } : null;

    return {
      docs: paginated,
      lastDoc: lastPaginatedDoc,
      hasMore: startIndex + PAGE_SIZE < filtered.length
    };
  }

  // Otherwise, run standard index-safe queries
  let q;
  if (usnFilter) {
    q = query(
      collection(db, RESULTS_COL),
      where('usn', '==', usnFilter.toUpperCase().trim()),
      orderBy('timestamp', 'desc'),
      limit(PAGE_SIZE)
    );
  } else if (sgpaMin !== null && sgpaMax !== null && sgpaMin !== '' && sgpaMax !== '') {
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

// ─── Curriculum Management (Dynamic Database-driven Engine) ──────────────────

const curriculumCache = {};

// Fetch curriculum with memory + localStorage caching
export async function fetchCurriculum(branch, semester) {
  const cacheKey = `${branch}_${semester}`;
  
  if (curriculumCache[cacheKey]) {
    return curriculumCache[cacheKey];
  }

  try {
    const cached = localStorage.getItem(`curriculum_${cacheKey}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      curriculumCache[cacheKey] = parsed;
      return parsed;
    }
  } catch (e) { /* ignore */ }

  if (!db) return [];
  
  const docId = `${branch}_${semester}`;
  const docRef = doc(db, 'curriculum', docId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const subjects = snap.data().subjects || [];
    curriculumCache[cacheKey] = subjects;
    try {
      localStorage.setItem(`curriculum_${cacheKey}`, JSON.stringify(subjects));
    } catch (e) { /* ignore */ }
    return subjects;
  }
  return [];
}

// Save/Update curriculum (Admin only)
export async function saveCurriculum(branch, semester, subjects) {
  if (!db) throw new Error('Firebase not initialized');
  const docId = `${branch}_${semester}`;
  const docRef = doc(db, 'curriculum', docId);
  await setDoc(docRef, { branch, semester: Number(semester), subjects }, { merge: true });
  
  const cacheKey = `${branch}_${semester}`;
  delete curriculumCache[cacheKey];
  try {
    localStorage.removeItem(`curriculum_${cacheKey}`);
  } catch (e) { /* ignore */ }
}

// Check and automatically self-seed default curriculum if collection is empty
export async function checkAndSeedCurriculum() {
  if (!db) return;
  const testRef = doc(db, 'curriculum', 'cs-ds_4');
  const testSnap = await getDoc(testRef);
  
  if (!testSnap.exists()) {
    console.log('[Curriculum] Seeding default curriculum data in Firestore...');
    const batch = writeBatch(db);
    
    const BRANCHES = [
      { id: 'cs-ds', name: 'CS&E (Data Science)' },
      { id: 'cse',   name: 'Computer Science & Engineering' },
      { id: 'aiml',  name: 'AI & Machine Learning' },
      { id: 'ise',   name: 'Information Science & Engineering' },
      { id: 'csd',   name: 'Computer Science & Design' },
    ];
    const SEMESTERS = [3, 4, 5, 6];
    
    const DEFAULTS = {
      'cs-ds': {
        3: [
          { key: 'math',     code: 'BCS301',     label: 'Mathematics for Computer Science',                  alias: 'Math',          credits: 4 },
          { key: 'dsa',      code: 'BCS302',     label: 'Data Structures and Applications',                  alias: 'DSA',           credits: 4 },
          { key: 'co',       code: 'BCS303',     label: 'Computer Organization and Architecture',            alias: 'COA',           credits: 3 },
          { key: 'oops',     code: 'BCS304',     label: 'Object Oriented Programming with Java',             alias: 'Java/OOP',      credits: 3 },
          { key: 'dsLab',    code: 'BCSL305',    label: 'Data Structures Lab',                               alias: 'DSA Lab',       credits: 1, hasLab: true },
          { key: 'scrLab',   code: 'BCS306',     label: 'Scripting Language Lab',                           alias: 'Python Lab',    credits: 1, hasLab: true },
          { key: 'scr',      code: 'BHS307',     label: 'Social Connect and Responsibility',                 alias: 'SCR',           credits: 1 },
          { key: 'pe',       code: 'BMNPHE309',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
        ],
        4: [
          { key: 'ada',      code: 'BCSPCC401',  label: 'Analysis and Design of Algorithms',                 alias: 'ADA',           credits: 4 },
          { key: 'advJava',  code: 'BCSPCC402',  label: 'Advanced Java',                                     alias: 'Adv. Java',     credits: 4 },
          { key: 'dbms',     code: 'BCSPCC403',  label: 'Database Management Systems',                        alias: 'DBMS',          credits: 4 },
          { key: 'dms',      code: 'BCSESC404A', label: 'Discrete Mathematical Structures and Graph Theory',  alias: 'DMS',           credits: 3 },
          { key: 'biology',  code: 'BBTBIO405',  label: 'Biology for Engineers',                             alias: 'Biology',       credits: 2 },
          { key: 'adaLab',   code: 'BCSPCL406',  label: 'Analysis And Design of Algorithms Lab',              alias: 'ADA Lab',       credits: 1, hasLab: true },
          { key: 'gitLab',   code: 'BCSAEC407A', label: 'Version Control with GIT-Lab',                       alias: 'Git Lab',       credits: 1, hasLab: true },
          { key: 'evs',      code: 'BHSENV408',  label: 'Environmental Studies',                             alias: 'EVS',           credits: 1 },
          { key: 'pe',       code: 'BMNPHE409',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
        ],
        5: [
          { key: 'cn',       code: 'BCS501',     label: 'Computer Networks',                                 alias: 'CN',            credits: 4 },
          { key: 'se',       code: 'BCS502',     label: 'Software Engineering & Project Management',         alias: 'SEPM',          credits: 4 },
          { key: 'wt',       code: 'BCS503',     label: 'Web Technology & its Applications',                 alias: 'Web Tech',      credits: 3 },
          { key: 'pe1',      code: 'BCSE504',    label: 'Professional Elective 1',                           alias: 'PE-1',          credits: 3 },
          { key: 'oe1',      code: 'BCSO505',    label: 'Open Elective 1',                                   alias: 'OE-1',          credits: 3 },
          { key: 'cnLab',    code: 'BCSL506',    label: 'Computer Networks Lab',                             alias: 'CN Lab',        credits: 1, hasLab: true },
          { key: 'wtLab',    code: 'BCSL507',    label: 'Web Technology Lab',                                alias: 'Web Lab',       credits: 1, hasLab: true },
          { key: 'pe',       code: 'BMNPHE509',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
        ],
        6: [
          { key: 'cd',       code: 'BCS601',     label: 'Compiler Design',                                   alias: 'Compiler',      credits: 4 },
          { key: 'cg',       code: 'BCS602',     label: 'Computer Graphics & Visualization',                 alias: 'Graphics',      credits: 4 },
          { key: 'st',       code: 'BCS603',     label: 'Software Testing',                                  alias: 'Testing',       credits: 3 },
          { key: 'pe2',      code: 'BCSE604',    label: 'Professional Elective 2',                           alias: 'PE-2',          credits: 3 },
          { key: 'oe2',      code: 'BCSO605',    label: 'Open Elective 2',                                   alias: 'OE-2',          credits: 3 },
          { key: 'miniProj', code: 'BCSMP606',    label: 'Mini Project',                                      alias: 'Mini Project',  credits: 2 },
          { key: 'stLab',    code: 'BCSL607',    label: 'Software Testing Lab',                              alias: 'Testing Lab',   credits: 1, hasLab: true },
          { key: 'pe',       code: 'BMNPHE609',  label: 'Physical Education',                                alias: 'PE',            credits: 0 },
        ]
      }
    };

    // Clone templates for all other branches (providing fully loaded starting configs)
    for (const b of BRANCHES) {
      if (b.id === 'cs-ds') continue;
      DEFAULTS[b.id] = {};
      for (const sem of SEMESTERS) {
        DEFAULTS[b.id][sem] = JSON.parse(JSON.stringify(DEFAULTS['cs-ds'][sem]));
      }
    }

    for (const b of BRANCHES) {
      for (const sem of SEMESTERS) {
        const docId = `${b.id}_${sem}`;
        const docRef = doc(db, 'curriculum', docId);
        const subjects = DEFAULTS[b.id]?.[sem] || [];
        batch.set(docRef, { branch: b.id, semester: sem, subjects });
      }
    }

    await batch.commit();
    console.log('[Curriculum] Seeding finished successfully.');
  }
}

// ─── Advanced Dashboard Leaderboards & Stats Aggregation ──────────────────────

export async function getLeaderboardStats() {
  if (!db) return { branchLeaderboard: [], failedSubjects: [], topPerformingSubjects: [] };
  
  // Load last 500 records to perform safe in-memory aggregation without compound indexes
  const q = query(collection(db, RESULTS_COL), orderBy('timestamp', 'desc'), limit(500));
  const snap = await withTimeout(getDocs(q), 10000, null);
  if (!snap) return { branchLeaderboard: [], failedSubjects: [], topPerformingSubjects: [] };

  const records = snap.docs.map(d => d.data());
  
  // 1. Branch Leaderboard (Average SGPA)
  const branchMap = {};
  records.forEach(r => {
    const b = r.branch || 'cs-ds';
    if (!branchMap[b]) branchMap[b] = { count: 0, sum: 0 };
    branchMap[b].count++;
    branchMap[b].sum += r.sgpa || 0;
  });

  const branchLeaderboard = Object.entries(branchMap).map(([id, info]) => ({
    id,
    avg: parseFloat((info.sum / info.count).toFixed(2)),
    submissions: info.count,
  })).sort((a, b) => b.avg - a.avg);

  // 2. Subject Stats (Fails & Top Grades)
  const subjectMap = {};
  records.forEach(r => {
    if (!r.subjects) return;
    Object.values(r.subjects).forEach(sub => {
      const code = sub.code || 'UNKNOWN';
      const label = sub.label || code;
      const gp = Number(sub.gradePoint ?? 0);
      const credits = Number(sub.credits ?? 0);
      
      if (!subjectMap[code]) {
        subjectMap[code] = { code, label, count: 0, fails: 0, outstanding: 0, gpSum: 0, isNonCredit: credits === 0 };
      }
      
      // Accumulate
      subjectMap[code].count++;
      subjectMap[code].gpSum += gp;
      if (gp === 0) subjectMap[code].fails++;
      if (gp === 10) subjectMap[code].outstanding++;
    });
  });

  const allSubjects = Object.values(subjectMap).map(s => ({
    ...s,
    avgGP: parseFloat((s.gpSum / s.count).toFixed(2)),
    failRate: parseFloat(((s.fails / s.count) * 100).toFixed(1)),
    outstandingRate: parseFloat(((s.outstanding / s.count) * 100).toFixed(1)),
  }));

  // Sort failed subjects (most fails first)
  const failedSubjects = [...allSubjects]
    .filter(s => s.fails > 0)
    .sort((a, b) => b.fails - a.fails || b.failRate - a.failRate)
    .slice(0, 5);

  // Sort top performing subjects (highest average grade point first)
  const topPerformingSubjects = [...allSubjects]
    .filter(s => s.count >= 2)
    .sort((a, b) => b.avgGP - a.avgGP)
    .slice(0, 5);

  return {
    branchLeaderboard,
    failedSubjects,
    topPerformingSubjects,
  };
}

