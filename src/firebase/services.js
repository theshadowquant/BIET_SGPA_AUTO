/**
 * Firebase Services Layer — Production Grade
 *
 * Performance notes:
 * - Analytics: single doc read + real-time listener (never scans collection)
 * - Visitor count: stored in analytics/global via increment (no collection scan)
 * - Pagination: cursor-based, configurable page size, never loads full collection at once
 * - All queries have explicit 8-second timeouts to prevent UI hangs
 * - avgSGPA is DERIVED: sgpaSum / totalCalculations (never stored directly)
 * - Identity enforcement: identities/{usn} collection locks USN↔Name mapping
 * - Duplicate prevention: per-USN per-semester uniqueness enforced via transaction
 */

import {
  collection, doc, getDoc, setDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, getDocs,
  writeBatch, serverTimestamp, increment, onSnapshot, runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import { calculateNameSuspicionScore } from '../utils/validation';

const RESULTS_COL     = 'results';
const ANALYTICS_DOC   = 'analytics/global';
const VISITS_COL      = 'visits';
const IDENTITIES_COL  = 'identities';  // USN → Name lock collection
const SETTINGS_COL    = 'settings';    // Admin settings (exam session, etc.)
const ADMINS_COL      = 'admins';      // Admin collection for RBAC
const AUDIT_LOGS_COL  = 'audit_logs';  // Immutable security audit logs
const DEFAULT_PAGE_SIZE = 20;
const USN_PREFIX_END  = '\uf8ff';
const ANALYTICS_PAGE_SIZE = 250;

let analyticsResultsCache = null;
let analyticsResultsPromise = null;

function invalidateAnalyticsResultsCache() {
  analyticsResultsCache = null;
  analyticsResultsPromise = null;
}

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
  invalidateAnalyticsResultsCache();
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

// ─── Student CGPA (latest saved result for each completed semester) ───────────
export async function getStudentCGPA(usn, selectedSemester = null) {
  if (!db) return { cgpa: null, latestSemester: 0, completedSemesters: [], missingSemesters: [], semesterBreakdown: [] };

  // A student has at most eight semesters. The cap allows retries while keeping
  // this a small, USN-indexed read instead of a collection scan.
  const q = query(
    collection(db, RESULTS_COL),
    where('usn', '==', usn.toUpperCase().trim()),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  const snap = await withTimeout(getDocs(q), 8000, null);
  if (!snap) throw new Error('Unable to load semester results');

  const latestBySemester = new Map();
  snap.docs.forEach(resultDoc => {
    const record = resultDoc.data();
    const sem = Number(record.semester);
    if (sem >= 1 && sem <= 8 && !latestBySemester.has(sem)) latestBySemester.set(sem, record);
  });

  const highestSavedSemester = Math.max(0, ...latestBySemester.keys());
  const latestSemester = Math.max(Number(selectedSemester) || 0, highestSavedSemester);
  const completedSemesters = [...latestBySemester.keys()].sort((a, b) => a - b);
  const missingSemesters = Array.from({ length: latestSemester }, (_, index) => index + 1)
    .filter(sem => !latestBySemester.has(sem));

  // Build a per-semester breakdown array for the CGPA lookup panel
  const semesterBreakdown = completedSemesters.map(sem => {
    const record = latestBySemester.get(sem);
    return {
      semester: sem,
      sgpa: parseFloat(Number(record.sgpa || 0).toFixed(2)),
      year: Math.ceil(sem / 2),
      semInYear: sem % 2 === 0 ? 2 : 1,
      name: record.name || '',
      branch: record.branch || '',
    };
  });

  if (!latestSemester || missingSemesters.length) {
    return { cgpa: null, latestSemester, completedSemesters, missingSemesters, semesterBreakdown };
  }

  const total = Array.from(latestBySemester.values())
    .filter(record => Number(record.semester) <= latestSemester)
    .reduce((sum, record) => sum + Number(record.sgpa || 0), 0);

  return {
    cgpa: parseFloat((total / latestSemester).toFixed(2)),
    latestSemester,
    completedSemesters,
    missingSemesters: [],
    semesterBreakdown,
  };
}

// ─── Paginated Results (server-side filters + snapshot cursors) ──────────────
function toNameSearchPrefix(value) {
  return value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    .map(word => `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`).join(' ');
}

export async function getPaginatedResults({
  lastDoc = null, nameFilter = '', usnFilter = '', sgpaMin = null, sgpaMax = null,
  branchFilter = '', semesterFilter = null,
  pageSize = DEFAULT_PAGE_SIZE, // supports 20, 50, 100, 500, 1000, 2000, 'all'
} = {}) {
  if (!db) return { docs: [], lastDoc: null, hasMore: false };

  const isAll = pageSize === 'all';
  const effectivePageSize = isAll ? 5000 : Number(pageSize);
  const queryPageSize = isAll ? 5000 : effectivePageSize + 1;

  const constraints = [];
  const normalizedUsn = usnFilter.toUpperCase().trim();
  const normalizedName = toNameSearchPrefix(nameFilter);
  const hasNameFilter = Boolean(normalizedName);
  const hasUsnFilter = Boolean(normalizedUsn);
  const hasMin = sgpaMin !== null && sgpaMin !== '';
  const hasMax = sgpaMax !== null && sgpaMax !== '';

  if (branchFilter) constraints.push(where('branch', '==', branchFilter));
  if (semesterFilter !== null && semesterFilter !== '') constraints.push(where('semester', '==', Number(semesterFilter)));
  if (hasNameFilter) {
    constraints.push(where('name', '>=', normalizedName));
    constraints.push(where('name', '<=', `${normalizedName}${USN_PREFIX_END}`));
  }
  if (hasUsnFilter) {
    constraints.push(where('usn', '>=', normalizedUsn));
    constraints.push(where('usn', '<=', `${normalizedUsn}${USN_PREFIX_END}`));
  }
  if (hasMin) constraints.push(where('sgpa', '>=', Number(sgpaMin)));
  if (hasMax) constraints.push(where('sgpa', '<=', Number(sgpaMax)));
  if ((hasMin && !Number.isFinite(Number(sgpaMin))) || (hasMax && !Number.isFinite(Number(sgpaMax)))) {
    throw new Error('SGPA filters must be valid numbers');
  }
  if (hasMin && hasMax && Number(sgpaMin) > Number(sgpaMax)) {
    throw new Error('Minimum SGPA cannot exceed maximum SGPA');
  }

  if (hasNameFilter) constraints.push(orderBy('name', 'asc'));
  if (hasUsnFilter) constraints.push(orderBy('usn', 'asc'));
  if (hasMin || hasMax) constraints.push(orderBy('sgpa', 'asc'));
  constraints.push(orderBy('timestamp', 'desc'));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  constraints.push(limit(queryPageSize));

  const q = query(collection(db, RESULTS_COL), ...constraints);
  const snap = await withTimeout(getDocs(q), 10000, null);
  if (!snap) throw new Error('Query timed out — check Firestore indexes and rules');

  const pageDocs = snap.docs.slice(0, effectivePageSize);
  return {
    docs: pageDocs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: pageDocs[pageDocs.length - 1] ?? null,
    hasMore: !isAll && snap.docs.length > effectivePageSize,
  };
}

// ─── Delete Result ─────────────────────────────────────────────────────────────
export async function deleteResult(id) {
  if (!db) throw new Error('Firebase not initialized');
  const resultRef = doc(db, RESULTS_COL, id);
  await runTransaction(db, async (transaction) => {
    const resultSnap = await transaction.get(resultRef);
    if (!resultSnap.exists()) return;
    transaction.delete(resultRef);
    transaction.set(doc(db, ANALYTICS_DOC), {
      totalCalculations: increment(-1),
      sgpaSum: increment(-parseFloat(resultSnap.data().sgpa)),
    }, { merge: true });
  });
  invalidateAnalyticsResultsCache();
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

async function getAllResultsForAnalytics() {
  if (analyticsResultsCache) return analyticsResultsCache;
  if (analyticsResultsPromise) return analyticsResultsPromise;

  analyticsResultsPromise = (async () => {
    const records = [];
    let cursor = null;
    do {
      const constraints = [orderBy('timestamp', 'desc')];
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(ANALYTICS_PAGE_SIZE));
      const snap = await withTimeout(getDocs(query(collection(db, RESULTS_COL), ...constraints)), 10000, null);
      if (!snap) throw new Error('Analytics query timed out');
      records.push(...snap.docs.map(d => d.data()));
      cursor = snap.docs[snap.docs.length - 1] ?? null;
      if (snap.docs.length < ANALYTICS_PAGE_SIZE) break;
    } while (cursor);
    analyticsResultsCache = records;
    return records;
  })();

  try {
    return await analyticsResultsPromise;
  } finally {
    analyticsResultsPromise = null;
  }
}

// ─── SGPA Distribution for chart ─────────────────────────────────────────────
export async function getSGPADistribution() {
  if (!db) return [];
  const records = await getAllResultsForAnalytics();

  const buckets = { '< 6.0': 0, '6.0–6.9': 0, '7.0–7.9': 0, '8.0–8.9': 0, '9.0–10': 0 };
  records.forEach(record => {
    const s = record.sgpa;
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

  const q = query(
    collection(db, RESULTS_COL),
    where('timestamp', '>=', sevenDaysAgo),
    orderBy('timestamp', 'asc')
  );
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
// Also seeds any newly-added departments on upgrade
export async function checkAndSeedCurriculum() {
  if (!db) return;
  // Check for cv_4 (Civil branch) — only seeded in the expanded version
  // This allows us to automatically fill new branches even if old ones exist
  const testRef = doc(db, 'curriculum', 'cv_4');
  const testSnap = await getDoc(testRef);

  if (!testSnap.exists()) {
    console.log('[Curriculum] Seeding default curriculum data in Firestore...');
    const batch = writeBatch(db);

    // ── Common 1st & 2nd Semester (Physics Cycle) ─────────────────────────
    const SEM1_PHYSICS = [
      { key: 'math1',   code: 'BMATE101',  label: 'Mathematics - I (Calculus & Linear Algebra)', alias: 'Math-I',    credits: 4 },
      { key: 'phy',     code: 'BPHYE102',  label: 'Engineering Physics',                          alias: 'Physics',   credits: 4 },
      { key: 'chem1',   code: 'BCHEE103',  label: 'Basic Electronics',                            alias: 'BE',        credits: 3 },
      { key: 'prog',    code: 'BPWSE104',  label: 'Problem Solving Using Python',                 alias: 'Python',    credits: 3 },
      { key: 'eng',     code: 'BESCK105',  label: 'Elements of Civil Engineering',                alias: 'ECE-1',     credits: 3 },
      { key: 'phyLab',  code: 'BPHYL106',  label: 'Engineering Physics Lab',                      alias: 'Physics Lab',credits:1, hasLab: true },
      { key: 'progLab', code: 'BPWSL107',  label: 'Problem Solving Using Python Lab',             alias: 'Python Lab',credits: 1, hasLab: true },
      { key: 'ws',      code: 'BWSKS108',  label: 'Workshop / Mfg. Practice',                     alias: 'Workshop',  credits: 1 },
      { key: 'pe',      code: 'BMNPHE109', label: 'Physical Education',                           alias: 'PE',        credits: 0 },
    ];

    const SEM2_CHEM = [
      { key: 'math2',   code: 'BMATE201',  label: 'Mathematics - II (Advanced Calculus)',         alias: 'Math-II',   credits: 4 },
      { key: 'chem',    code: 'BCHEE202',  label: 'Engineering Chemistry',                        alias: 'Chemistry', credits: 4 },
      { key: 'elec',    code: 'BELCE203',  label: 'Fundamentals of Electrical Engineering',       alias: 'FEE',       credits: 3 },
      { key: 'de',      code: 'BESCK204',  label: 'Design Engineering',                           alias: 'DE',        credits: 3 },
      { key: 'egdrg',   code: 'BEGCK205',  label: 'Engineering Drawing',                          alias: 'ED',        credits: 3 },
      { key: 'chemLab', code: 'BCHEML206', label: 'Engineering Chemistry Lab',                    alias: 'Chem Lab',  credits: 1, hasLab: true },
      { key: 'ws',      code: 'BWSKL207',  label: 'Workshop Practice Lab',                        alias: 'Workshop',  credits: 1, hasLab: true },
      { key: 'idp',     code: 'BIDPK208',  label: 'Innovative Design Practice',                   alias: 'IDP',       credits: 1 },
      { key: 'pe',      code: 'BMNPHE209', label: 'Physical Education',                           alias: 'PE',        credits: 0 },
    ];

    // ── CS-DS Branch Subjects ─────────────────────────────────────────────
    const CS_DS_SEMS = {
      1: SEM1_PHYSICS,
      2: SEM2_CHEM,
      3: [
        { key: 'math3',   code: 'BCS301',    label: 'Mathematics for Computer Science',               alias: 'Math-III',  credits: 4 },
        { key: 'dsa',     code: 'BCS302',    label: 'Data Structures and Applications',               alias: 'DSA',       credits: 4 },
        { key: 'coa',     code: 'BCS303',    label: 'Computer Organization and Architecture',         alias: 'COA',       credits: 3 },
        { key: 'oops',    code: 'BCS304',    label: 'Object Oriented Programming with Java',          alias: 'Java/OOP',  credits: 3 },
        { key: 'dsaLab',  code: 'BCSL305',   label: 'Data Structures Lab',                            alias: 'DSA Lab',   credits: 1, hasLab: true },
        { key: 'scrLab',  code: 'BCS306',    label: 'Scripting Language Lab',                         alias: 'Python Lab',credits: 1, hasLab: true },
        { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      4: [
        { key: 'ada',     code: 'BCSPCC401', label: 'Analysis and Design of Algorithms',              alias: 'ADA',       credits: 4 },
        { key: 'advJava', code: 'BCSPCC402', label: 'Advanced Java',                                  alias: 'Adv. Java', credits: 4 },
        { key: 'dbms',    code: 'BCSPCC403', label: 'Database Management Systems',                    alias: 'DBMS',      credits: 4 },
        { key: 'dms',     code: 'BCSESC404A',label: 'Discrete Mathematical Structures & Graph Theory',alias: 'DMS',       credits: 3 },
        { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
        { key: 'adaLab',  code: 'BCSPCL406', label: 'Analysis and Design of Algorithms Lab',          alias: 'ADA Lab',   credits: 1, hasLab: true },
        { key: 'gitLab',  code: 'BCSAEC407A',label: 'Version Control with GIT-Lab',                   alias: 'Git Lab',   credits: 1, hasLab: true },
        { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      5: [
        { key: 'cn',      code: 'BCS501',    label: 'Computer Networks',                              alias: 'CN',        credits: 4 },
        { key: 'se',      code: 'BCS502',    label: 'Software Engineering & Project Management',      alias: 'SEPM',      credits: 4 },
        { key: 'wt',      code: 'BCS503',    label: 'Web Technology & its Applications',              alias: 'Web Tech',  credits: 3 },
        { key: 'pe1',     code: 'BCSE504',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
        { key: 'oe1',     code: 'BCSO505',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
        { key: 'cnLab',   code: 'BCSL506',   label: 'Computer Networks Lab',                          alias: 'CN Lab',    credits: 1, hasLab: true },
        { key: 'wtLab',   code: 'BCSL507',   label: 'Web Technology Lab',                             alias: 'Web Lab',   credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      6: [
        { key: 'cd',      code: 'BCS601',    label: 'Compiler Design',                               alias: 'Compiler',  credits: 4 },
        { key: 'cg',      code: 'BCS602',    label: 'Computer Graphics & Visualization',              alias: 'Graphics',  credits: 4 },
        { key: 'st',      code: 'BCS603',    label: 'Software Testing',                               alias: 'Testing',   credits: 3 },
        { key: 'pe2',     code: 'BCSE604',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
        { key: 'oe2',     code: 'BCSO605',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
        { key: 'mini',    code: 'BCSMP606',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
        { key: 'stLab',   code: 'BCSL607',   label: 'Software Testing Lab',                           alias: 'Testing Lab',credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      7: [
        { key: 'ml',      code: 'BCS701',    label: 'Machine Learning',                               alias: 'ML',        credits: 4 },
        { key: 'ai',      code: 'BCS702',    label: 'Artificial Intelligence',                        alias: 'AI',        credits: 4 },
        { key: 'pe3',     code: 'BCSE703',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
        { key: 'oe3',     code: 'BCSO704',   label: 'Open Elective 3',                               alias: 'OE-3',      credits: 3 },
        { key: 'proj',    code: 'BCSPR705',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
        { key: 'intern',  code: 'BCSIT706',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
        { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      8: [
        { key: 'bigData', code: 'BCS801',    label: 'Big Data Analytics',                             alias: 'Big Data',  credits: 4 },
        { key: 'iot',     code: 'BCS802',    label: 'Internet of Things',                             alias: 'IoT',       credits: 4 },
        { key: 'pe4',     code: 'BCSE803',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
        { key: 'projFin', code: 'BCSPR804',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
        { key: 'seminar', code: 'BCSSEM805', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
        { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
    };

    // ── AIML Branch Subjects ───────────────────────────────────────────────
    const AIML_SEMS = {
      ...CS_DS_SEMS,
      4: [
        { key: 'ada',     code: 'BCSPCC401', label: 'Analysis & Design of Algorithms (ADA)',            alias: 'ADA',       credits: 4 },
        { key: 'ai',      code: 'BAIPCC402', label: 'Artificial Intelligence (AI)',                      alias: 'AI',        credits: 4 },
        { key: 'dbms',    code: 'BCSPCC403', label: 'Database Management Systems (DBMS)',                  alias: 'DBMS',      credits: 4 },
        { key: 'adaLab',  code: 'BCSPCL406', label: 'Analysis & Design of Algorithms Lab (ADA Lab)',      alias: 'ADA Lab',   credits: 1, hasLab: true },
        { key: 'la',      code: 'BSCESC404B',label: 'Linear Algebra (LA)',                               alias: 'LA',        credits: 3 },
        { key: 'daLab',   code: 'BAIAEC407D',label: 'Python for Data Analytics - Lab (Data Analytics Lab)',alias: 'Data Lab',  credits: 1, hasLab: true },
        { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Computer Engineers',                    alias: 'Biology',   credits: 2 },
        { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ]
    };

    // ── ECE Branch Subjects ────────────────────────────────────────────────
    const ECE_SEMS = {
      1: SEM1_PHYSICS, 2: SEM2_CHEM,
      3: [
        { key: 'nw',      code: 'BEC301',    label: 'Network Theory',                                 alias: 'Network',   credits: 4 },
        { key: 'edc',     code: 'BEC302',    label: 'Electronic Devices & Circuits',                  alias: 'EDC',       credits: 4 },
        { key: 'signals', code: 'BEC303',    label: 'Signals and Systems',                            alias: 'S&S',       credits: 3 },
        { key: 'dl',      code: 'BEC304',    label: 'Digital Logic Design',                           alias: 'DLD',       credits: 3 },
        { key: 'edcLab',  code: 'BECL305',   label: 'Electronic Devices & Circuits Lab',              alias: 'EDC Lab',   credits: 1, hasLab: true },
        { key: 'dlLab',   code: 'BECL306',   label: 'Digital Logic Design Lab',                       alias: 'DLD Lab',   credits: 1, hasLab: true },
        { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      4: [
        { key: 'emt',     code: 'BECPCC401', label: 'Electromagnetics Theory',                       alias: 'EMT',       credits: 4 },
        { key: 'pcs',     code: 'BECPCC402', label: 'Principles of Communication Systems',            alias: 'PCS',       credits: 4 },
        { key: 'cs',      code: 'BECPCC403', label: 'Control Systems',                               alias: 'CS',        credits: 4 },
        { key: 'mc',      code: 'BECESC404A',label: '8051 Microcontroller',                           alias: 'MC',        credits: 3 },
        { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'BIO',       credits: 2 },
        { key: 'cLab',    code: 'BECPCL406', label: 'Communication Lab',                            alias: 'C_LAB',     credits: 1, hasLab: true },
        { key: 'mcLab',   code: 'BECAEC407A',label: '8051 Microcontroller Lab',                       alias: 'MC_LAB',    credits: 1, hasLab: true },
        { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
        { key: 'yoga',    code: 'BMNYOG409', label: 'Yoga',                                           alias: 'Yoga',      credits: 0 },
      ],
      5: [
        { key: 'dsp',     code: 'BEC501',    label: 'Digital Signal Processing',                      alias: 'DSP',       credits: 4 },
        { key: 'vlsi',    code: 'BEC502',    label: 'VLSI Design',                                    alias: 'VLSI',      credits: 4 },
        { key: 'emw',     code: 'BEC503',    label: 'Electromagnetic Waves',                          alias: 'EMW',       credits: 3 },
        { key: 'pe1',     code: 'BECE504',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
        { key: 'oe1',     code: 'BECO505',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
        { key: 'dspLab',  code: 'BECL506',   label: 'DSP Lab',                                        alias: 'DSP Lab',   credits: 1, hasLab: true },
        { key: 'vLab',    code: 'BECL507',   label: 'VLSI Lab',                                       alias: 'VLSI Lab',  credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      6: [
        { key: 'antennas',code: 'BEC601',    label: 'Antennas & Propagation',                         alias: 'Antennas',  credits: 4 },
        { key: 'wireless',code: 'BEC602',    label: 'Wireless Communication',                         alias: 'Wireless',  credits: 4 },
        { key: 'pe2',     code: 'BECE603',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
        { key: 'oe2',     code: 'BECO604',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
        { key: 'mini',    code: 'BECMP605',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
        { key: 'aLab',    code: 'BECL606',   label: 'Antenna & Propagation Lab',                      alias: 'Ant. Lab',  credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      7: [
        { key: 'emb',     code: 'BEC701',    label: 'Embedded Systems',                               alias: 'Embedded',  credits: 4 },
        { key: 'iot',     code: 'BEC702',    label: 'Internet of Things',                             alias: 'IoT',       credits: 4 },
        { key: 'pe3',     code: 'BECE703',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
        { key: 'proj1',   code: 'BECPR704',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
        { key: 'intern',  code: 'BECIT705',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
        { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      8: [
        { key: 'radar',   code: 'BEC801',    label: 'Radar & Navigation Systems',                     alias: 'Radar',     credits: 4 },
        { key: 'pe4',     code: 'BECE802',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
        { key: 'proj2',   code: 'BECPR803',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
        { key: 'seminar', code: 'BECSEM804', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
        { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
    };

    // ── Mechanical Branch Subjects ─────────────────────────────────────────
    const ME_SEMS = {
      1: SEM1_PHYSICS, 2: SEM2_CHEM,
      3: [
        { key: 'mat',     code: 'BME301',    label: 'Material Science',                               alias: 'MatSci',    credits: 4 },
        { key: 'tom',     code: 'BME302',    label: 'Theory of Machines',                             alias: 'TOM',       credits: 4 },
        { key: 'fluid',   code: 'BME303',    label: 'Fluid Mechanics',                               alias: 'FM',        credits: 3 },
        { key: 'mfg',     code: 'BME304',    label: 'Manufacturing Process - I',                      alias: 'Mfg-I',     credits: 3 },
        { key: 'mLab',    code: 'BMEL305',   label: 'Manufacturing Lab',                              alias: 'Mfg Lab',   credits: 1, hasLab: true },
        { key: 'cad',     code: 'BMEL306',   label: 'CAD/CAM Lab',                                    alias: 'CAD Lab',   credits: 1, hasLab: true },
        { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      4: [
        { key: 'hmt',     code: 'BME401',    label: 'Heat & Mass Transfer',                           alias: 'HMT',       credits: 4 },
        { key: 'str',     code: 'BME402',    label: 'Strength of Materials',                          alias: 'SOM',       credits: 4 },
        { key: 'md',      code: 'BME403',    label: 'Machine Design',                               alias: 'MD',        credits: 4 },
        { key: 'mfg2',    code: 'BME404',    label: 'Manufacturing Process - II',                     alias: 'Mfg-II',    credits: 3 },
        { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
        { key: 'mdLab',   code: 'BMEL406',   label: 'Machine Design Lab',                             alias: 'MD Lab',    credits: 1, hasLab: true },
        { key: 'mfgLab',  code: 'BMEL407',   label: 'Manufacturing Lab - II',                         alias: 'Mfg Lab-II',credits: 1, hasLab: true },
        { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      5: [
        { key: 'turbo',   code: 'BME501',    label: 'Turbomachinery',                                 alias: 'Turbo',     credits: 4 },
        { key: 'ic',      code: 'BME502',    label: 'IC Engines',                                     alias: 'IC Eng',    credits: 4 },
        { key: 'fe',      code: 'BME503',    label: 'Finite Element Analysis',                        alias: 'FEA',       credits: 3 },
        { key: 'pe1',     code: 'BMEE504',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
        { key: 'oe1',     code: 'BMEO505',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
        { key: 'tLab',    code: 'BMEL506',   label: 'Turbomachinery Lab',                             alias: 'Turbo Lab', credits: 1, hasLab: true },
        { key: 'icLab',   code: 'BMEL507',   label: 'IC Engines Lab',                                 alias: 'IC Lab',    credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      6: [
        { key: 'ref',     code: 'BME601',    label: 'Refrigeration & Air Conditioning',               alias: 'RAC',       credits: 4 },
        { key: 'prod',    code: 'BME602',    label: 'Production Management',                          alias: 'Prod Mgmt', credits: 3 },
        { key: 'pe2',     code: 'BMEE603',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
        { key: 'oe2',     code: 'BMEO604',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
        { key: 'mini',    code: 'BMEMP605',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
        { key: 'racLab',  code: 'BMEL606',   label: 'RAC Lab',                                        alias: 'RAC Lab',   credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      7: [
        { key: 'rob',     code: 'BME701',    label: 'Robotics & Automation',                          alias: 'Robotics',  credits: 4 },
        { key: 'pe3',     code: 'BMEE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
        { key: 'proj1',   code: 'BMEPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
        { key: 'intern',  code: 'BMEIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
        { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      8: [
        { key: 'pe4',     code: 'BMEE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
        { key: 'proj2',   code: 'BMEPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
        { key: 'seminar', code: 'BMESEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
        { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
    };

    // ── Civil Branch Subjects ──────────────────────────────────────────────
    const CIVIL_SEMS = {
      1: SEM1_PHYSICS, 2: SEM2_CHEM,
      3: [
        { key: 'sm',      code: 'BCV301',    label: 'Structural Mechanics',                           alias: 'Struct. Mech',credits: 4 },
        { key: 'fluid',   code: 'BCV302',    label: 'Fluid Mechanics',                               alias: 'FM',        credits: 4 },
        { key: 'survey',  code: 'BCV303',    label: 'Surveying',                                      alias: 'Survey',    credits: 3 },
        { key: 'build',   code: 'BCV304',    label: 'Building Materials & Construction',              alias: 'BMC',       credits: 3 },
        { key: 'sLab',    code: 'BCVL305',   label: 'Surveying Lab',                                  alias: 'Survey Lab',credits: 1, hasLab: true },
        { key: 'fLab',    code: 'BCVL306',   label: 'Fluid Mechanics Lab',                            alias: 'FM Lab',    credits: 1, hasLab: true },
        { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      4: [
        { key: 'rcc',     code: 'BCV401',    label: 'Design of RCC Structures',                       alias: 'RCC',       credits: 4 },
        { key: 'geo',     code: 'BCV402',    label: 'Geotechnical Engineering',                       alias: 'Geo Eng',   credits: 4 },
        { key: 'trans',   code: 'BCV403',    label: 'Transportation Engineering',                     alias: 'Trans Eng', credits: 4 },
        { key: 'envEng',  code: 'BCV404',    label: 'Environmental Engineering',                      alias: 'Env Eng',   credits: 3 },
        { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
        { key: 'geoLab',  code: 'BCVL406',   label: 'Geotechnical Lab',                               alias: 'Geo Lab',   credits: 1, hasLab: true },
        { key: 'transLab',code: 'BCVL407',   label: 'Transportation Engg Lab',                        alias: 'Trans Lab', credits: 1, hasLab: true },
        { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      5: [
        { key: 'prestress',code: 'BCV501',   label: 'Prestressed Concrete Structures',                alias: 'PSC',       credits: 4 },
        { key: 'hydro',   code: 'BCV502',    label: 'Hydraulics & Water Resources',                   alias: 'Hydro',     credits: 4 },
        { key: 'pe1',     code: 'BCVE503',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
        { key: 'oe1',     code: 'BCVO504',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
        { key: 'compre',  code: 'BCV505',    label: 'Comprehension / MOOC',                           alias: 'MOOC',      credits: 2 },
        { key: 'conLab',  code: 'BCVL506',   label: 'Concrete Technology Lab',                        alias: 'Conc Lab',  credits: 1, hasLab: true },
        { key: 'hydLab',  code: 'BCVL507',   label: 'Hydraulics Lab',                                 alias: 'Hydro Lab', credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      6: [
        { key: 'pm',      code: 'BCV601',    label: 'Project Management & Entrepreneurship',          alias: 'PM&E',      credits: 3 },
        { key: 'pe2',     code: 'BCVE602',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
        { key: 'oe2',     code: 'BCVO603',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
        { key: 'mini',    code: 'BCVMP604',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
        { key: 'drawLab', code: 'BCVL605',   label: 'Building Drawing Lab',                           alias: 'Drawing Lab',credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      7: [
        { key: 'found',   code: 'BCV701',    label: 'Foundation Engineering',                         alias: 'Found Eng', credits: 4 },
        { key: 'pe3',     code: 'BCVE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
        { key: 'proj1',   code: 'BCVPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
        { key: 'intern',  code: 'BCVIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
        { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      8: [
        { key: 'pe4',     code: 'BCVE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
        { key: 'proj2',   code: 'BCVPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
        { key: 'seminar', code: 'BCVSEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
        { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
    };

    // ── Textile Branch Subjects ─────────────────────────────────────────────
    const TEXTILE_SEMS = {
      1: SEM1_PHYSICS, 2: SEM2_CHEM,
      3: [
        { key: 'yarn',    code: 'BTX301',    label: 'Yarn Manufacture - I',                           alias: 'Yarn-I',    credits: 4 },
        { key: 'fabric',  code: 'BTX302',    label: 'Fabric Manufacture - I',                         alias: 'Fabric-I',  credits: 4 },
        { key: 'tChem',   code: 'BTX303',    label: 'Textile Chemistry',                              alias: 'Tex Chem',  credits: 3 },
        { key: 'mech',    code: 'BTX304',    label: 'Mechanics of Textile Machinery',                  alias: 'Tex Mech',  credits: 3 },
        { key: 'yarnLab', code: 'BTXL305',   label: 'Yarn Manufacture Lab',                           alias: 'Yarn Lab',  credits: 1, hasLab: true },
        { key: 'fabLab',  code: 'BTXL306',   label: 'Fabric Manufacture Lab',                         alias: 'Fabric Lab',credits: 1, hasLab: true },
        { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      4: [
        { key: 'yarn2',   code: 'BTX401',    label: 'Yarn Manufacture - II',                          alias: 'Yarn-II',   credits: 4 },
        { key: 'fabric2', code: 'BTX402',    label: 'Fabric Manufacture - II',                        alias: 'Fabric-II', credits: 4 },
        { key: 'dyeing',  code: 'BTX403',    label: 'Textile Wet Processing',                         alias: 'Dyeing',    credits: 4 },
        { key: 'testing', code: 'BTX404',    label: 'Textile Testing & Quality Control',              alias: 'Testing',   credits: 3 },
        { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
        { key: 'dyeLab',  code: 'BTXL406',   label: 'Wet Processing Lab',                             alias: 'Dye Lab',   credits: 1, hasLab: true },
        { key: 'testLab', code: 'BTXL407',   label: 'Textile Testing Lab',                            alias: 'Test Lab',  credits: 1, hasLab: true },
        { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      5: [
        { key: 'garment', code: 'BTX501',    label: 'Garment Technology',                             alias: 'Garment',   credits: 4 },
        { key: 'manmade', code: 'BTX502',    label: 'Man-Made Fibres',                                alias: 'MMF',       credits: 4 },
        { key: 'pe1',     code: 'BTXE503',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
        { key: 'oe1',     code: 'BTXO504',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
        { key: 'gLab',    code: 'BTXL505',   label: 'Garment Lab',                                    alias: 'Garment Lab',credits: 1, hasLab: true },
        { key: 'mmLab',   code: 'BTXL506',   label: 'Man-Made Fibres Lab',                            alias: 'MMF Lab',   credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      6: [
        { key: 'nonWoven',code: 'BTX601',    label: 'Non-Woven Technology',                           alias: 'Non-Woven', credits: 4 },
        { key: 'pe2',     code: 'BTXE602',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
        { key: 'oe2',     code: 'BTXO603',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
        { key: 'mini',    code: 'BTXMP604',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
        { key: 'nvLab',   code: 'BTXL605',   label: 'Non-Woven Lab',                                  alias: 'NW Lab',    credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      7: [
        { key: 'techTex', code: 'BTX701',    label: 'Technical Textiles',                             alias: 'Tech Tex',  credits: 4 },
        { key: 'pe3',     code: 'BTXE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
        { key: 'proj1',   code: 'BTXPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
        { key: 'intern',  code: 'BTXIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
        { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      8: [
        { key: 'pe4',     code: 'BTXE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
        { key: 'proj2',   code: 'BTXPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
        { key: 'seminar', code: 'BTXSEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
        { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
    };

    // ── EEE Branch Subjects ────────────────────────────────────────────────
    const EEE_SEMS = {
      1: SEM1_PHYSICS, 2: SEM2_CHEM,
      3: [
        { key: 'circuits',code: 'BEE301',    label: 'Electrical Circuit Analysis',                    alias: 'Circuits',  credits: 4 },
        { key: 'emach',   code: 'BEE302',    label: 'Electrical Machines - I',                        alias: 'EM-I',      credits: 4 },
        { key: 'meas',    code: 'BEE303',    label: 'Electrical Measurements',                        alias: 'Measurements',credits: 3 },
        { key: 'cont',    code: 'BEE304',    label: 'Control Engineering',                            alias: 'Control',   credits: 3 },
        { key: 'emLab',   code: 'BEEL305',   label: 'Electrical Machines Lab',                        alias: 'EM Lab',    credits: 1, hasLab: true },
        { key: 'measLab', code: 'BEEL306',   label: 'Measurements Lab',                               alias: 'Meas Lab',  credits: 1, hasLab: true },
        { key: 'scr',     code: 'BHS307',    label: 'Social Connect and Responsibility',              alias: 'SCR',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE309', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      4: [
        { key: 'em2',     code: 'BEE401',    label: 'Electrical Machines - II',                       alias: 'EM-II',     credits: 4 },
        { key: 'power',   code: 'BEE402',    label: 'Power Systems - I',                              alias: 'Power-I',   credits: 4 },
        { key: 'pe_syst', code: 'BEE403',    label: 'Power Electronics',                              alias: 'Power Elec',credits: 4 },
        { key: 'sig',     code: 'BEE404',    label: 'Signals & Systems',                             alias: 'S&S',       credits: 3 },
        { key: 'bio',     code: 'BBTBIO405', label: 'Biology for Engineers',                          alias: 'Biology',   credits: 2 },
        { key: 'em2Lab',  code: 'BEEL406',   label: 'Electrical Machines Lab - II',                   alias: 'EM Lab-II', credits: 1, hasLab: true },
        { key: 'peLab',   code: 'BEEL407',   label: 'Power Electronics Lab',                          alias: 'PE Lab',    credits: 1, hasLab: true },
        { key: 'evs',     code: 'BHSENV408', label: 'Environmental Studies',                          alias: 'EVS',       credits: 1 },
        { key: 'pe',      code: 'BMNPHE409', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      5: [
        { key: 'ps2',     code: 'BEE501',    label: 'Power Systems - II',                             alias: 'Power-II',  credits: 4 },
        { key: 'drives',  code: 'BEE502',    label: 'Electrical Drives',                              alias: 'Drives',    credits: 4 },
        { key: 'pe1',     code: 'BEEE503',   label: 'Professional Elective 1',                        alias: 'PE-1',      credits: 3 },
        { key: 'oe1',     code: 'BEEO504',   label: 'Open Elective 1',                               alias: 'OE-1',      credits: 3 },
        { key: 'psLab',   code: 'BEEL505',   label: 'Power Systems Lab',                              alias: 'PS Lab',    credits: 1, hasLab: true },
        { key: 'dLab',    code: 'BEEL506',   label: 'Drives Lab',                                     alias: 'Drives Lab',credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE509', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      6: [
        { key: 'utilz',   code: 'BEE601',    label: 'Utilisation of Electrical Energy',               alias: 'Utilization',credits: 3 },
        { key: 'pe2',     code: 'BEEE602',   label: 'Professional Elective 2',                        alias: 'PE-2',      credits: 3 },
        { key: 'oe2',     code: 'BEEO603',   label: 'Open Elective 2',                               alias: 'OE-2',      credits: 3 },
        { key: 'mini',    code: 'BEEMP604',  label: 'Mini Project',                                   alias: 'Mini Proj', credits: 2 },
        { key: 'simLab',  code: 'BEEL605',   label: 'Simulation Lab',                                 alias: 'Sim Lab',   credits: 1, hasLab: true },
        { key: 'pe',      code: 'BMNPHE609', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      7: [
        { key: 're',      code: 'BEE701',    label: 'Renewable Energy Systems',                       alias: 'Renew Eng', credits: 4 },
        { key: 'pe3',     code: 'BEEE702',   label: 'Professional Elective 3',                        alias: 'PE-3',      credits: 3 },
        { key: 'proj1',   code: 'BEEPR703',  label: 'Project Phase 1',                               alias: 'Project-1', credits: 4 },
        { key: 'intern',  code: 'BEEIT704',  label: 'Internship',                                    alias: 'Internship',credits: 2 },
        { key: 'pe',      code: 'BMNPHE709', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
      8: [
        { key: 'pe4',     code: 'BEEE801',   label: 'Professional Elective 4',                        alias: 'PE-4',      credits: 3 },
        { key: 'proj2',   code: 'BEEPR802',  label: 'Project Phase 2 (Final)',                        alias: 'Project-2', credits: 6 },
        { key: 'seminar', code: 'BEESEM803', label: 'Technical Seminar',                              alias: 'Seminar',   credits: 1 },
        { key: 'pe',      code: 'BMNPHE809', label: 'Physical Education',                             alias: 'PE',        credits: 0 },
      ],
    };

    // ── Branch-to-Sems mapping ─────────────────────────────────────────────
    const ALL_BRANCHES = [
      { id: 'cs-ds', sems: CS_DS_SEMS },
      { id: 'cse',   sems: CS_DS_SEMS },   // Start same, admin edits to customize
      { id: 'aiml',  sems: AIML_SEMS },
      { id: 'ise',   sems: CS_DS_SEMS },
      { id: 'csd',   sems: CS_DS_SEMS },
      { id: 'csbs',  sems: CS_DS_SEMS },
      { id: 'ece',   sems: ECE_SEMS },
      { id: 'eie',   sems: ECE_SEMS },
      { id: 'vlsi',  sems: ECE_SEMS },
      { id: 'eee',   sems: EEE_SEMS },
      { id: 'me',    sems: ME_SEMS },
      { id: 'auto',  sems: ME_SEMS },
      { id: 'ipe',   sems: ME_SEMS },
      { id: 'cv',    sems: CIVIL_SEMS },
      { id: 'et',    sems: CIVIL_SEMS },
      { id: 'tx',    sems: TEXTILE_SEMS },
      { id: 'txd',   sems: TEXTILE_SEMS },
      { id: 'bt',    sems: CS_DS_SEMS },
      { id: 'ch',    sems: ME_SEMS },
    ];

    const ALL_SEMS = [1, 2, 3, 4, 5, 6, 7, 8];

    for (const branch of ALL_BRANCHES) {
      for (const sem of ALL_SEMS) {
        const docId = `${branch.id}_${sem}`;
        const docRef = doc(db, 'curriculum', docId);
        const subjects = branch.sems[sem] || [];
        batch.set(docRef, { branch: branch.id, semester: sem, subjects });
      }
    }

    // Firestore batch limit = 500 writes; with 19 branches × 8 sems = 152 docs → safe
    await batch.commit();
    console.log('[Curriculum] Seeding finished successfully.');
  }
}

// ─── Advanced Dashboard Leaderboards & Stats Aggregation ──────────────────────


export async function getLeaderboardStats() {
  if (!db) return { branchLeaderboard: [], failedSubjects: [], topPerformingSubjects: [] };
  
  // Aggregate the full dataset. The shared cursor-paged reader avoids an
  // arbitrary record ceiling and de-duplicates reads with SGPA distribution.
  const records = await getAllResultsForAnalytics();
  
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
      if (credits === 0) return;
      
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

// ─── Semester-wise Branch Leaderboard (client-side filter of cached data) ─────
// Zero extra Firestore reads — reuses the same shared cache as getLeaderboardStats
export async function getLeaderboardStatsBySemester(semester = null) {
  if (!db) return [];
  const records = await getAllResultsForAnalytics();

  // Filter by semester if specified; null = overall (all semesters)
  const filtered = semester !== null
    ? records.filter(r => Number(r.semester) === semester)
    : records;

  const branchMap = {};
  filtered.forEach(r => {
    const b = r.branch || 'cs-ds';
    if (!branchMap[b]) branchMap[b] = { count: 0, sum: 0 };
    branchMap[b].count++;
    branchMap[b].sum += r.sgpa || 0;
  });

  return Object.entries(branchMap)
    .map(([id, info]) => ({
      id,
      avg: parseFloat((info.sum / info.count).toFixed(2)),
      submissions: info.count,
    }))
    .sort((a, b) => b.avg - a.avg);
}

// ─── Student Identity Enforcement ─────────────────────────────────────────────
// identities/{usn} doc stores the canonical name for each USN.
// Once created, the mapping is immutable (only admin can override).

/**
 * Checks the USN→Name identity registry.
 *
 * Returns:
 *  { exists: false }               — USN is brand-new, can register freely
 *  { exists: true, conflict: false, registeredName } — USN exists and names match ✓
 *  { exists: true, conflict: true,  registeredName } — USN belongs to a different name ✗
 */
export async function checkStudentIdentity(usn, name) {
  if (!db || !usn) return { exists: false, conflict: false, registeredName: null };

  const ref = doc(db, IDENTITIES_COL, usn.toUpperCase().trim());
  const snap = await withTimeout(getDoc(ref), 5000, null);

  if (!snap || !snap.exists()) {
    return { exists: false, conflict: false, registeredName: null };
  }

  const registeredName = snap.data().name || '';
  const inputName = name.trim();
  const conflict = registeredName.toLowerCase().replace(/\s+/g, ' ')
    !== inputName.toLowerCase().replace(/\s+/g, ' ');

  return { exists: true, conflict, registeredName };
}

// ─── Duplicate Result Prevention ──────────────────────────────────────────────

/**
 * Checks if a result for this USN + semester already exists.
 *
 * Returns { exists: false } or { exists: true, existingRecord: object }
 */
export async function checkDuplicateResult(usn, semester) {
  if (!db || !usn || !semester) return { exists: false, existingRecord: null };

  const q = query(
    collection(db, RESULTS_COL),
    where('usn', '==', usn.toUpperCase().trim()),
    where('semester', '==', Number(semester)),
    orderBy('timestamp', 'desc'),
    limit(1)
  );

  const snap = await withTimeout(getDocs(q), 6000, null);
  if (!snap || snap.empty) return { exists: false, existingRecord: null };

  const d = snap.docs[0];
  return { exists: true, existingRecord: { id: d.id, ...d.data() } };
}

// ─── Update Existing Result ────────────────────────────────────────────────────

/**
 * Atomically updates an existing result document.
 * Adjusts the analytics sgpaSum by the delta (newSgpa - oldSgpa).
 *
 * @param {string} id        — Firestore document ID of the result to update
 * @param {{ name, sgpa, subjects, oldSgpa }} payload
 */
export async function updateResult(id, { name, sgpa, subjects, oldSgpa }) {
  if (!db) throw new Error('Firebase not initialized');

  await runTransaction(db, async (tx) => {
    const ref = doc(db, RESULTS_COL, id);
    const existing = await tx.get(ref);
    if (!existing.exists()) throw new Error('Record not found — it may have been deleted.');

    const delta = parseFloat(sgpa) - parseFloat(oldSgpa || existing.data().sgpa || 0);

    tx.update(ref, {
      name: name.trim(),
      sgpa: parseFloat(sgpa),
      subjects,
      updatedAt: serverTimestamp(),
    });

    // Adjust running SGPA sum without changing totalCalculations
    if (Math.abs(delta) > 0.0001) {
      tx.set(doc(db, ANALYTICS_DOC), {
        sgpaSum: increment(delta),
      }, { merge: true });
    }
  });

  invalidateAnalyticsResultsCache();
}

// ─── Full-Database Export (cursor-paged, no size limit) ───────────────────────

/**
 * Fetches ALL records matching the given filters using cursor-based pagination.
 * Designed for CSV export — never limited by page size.
 *
 * @param {Object} filters           — same shape as getPaginatedResults filters
 * @param {Function} [onProgress]    — optional callback(percent: number)
 * @returns {Promise<Array>}         — full array of matching records
 */
export async function exportAllResults(filters = {}, onProgress) {
  if (!db) return [];

  const {
    nameFilter = '', usnFilter = '', sgpaMin = null, sgpaMax = null,
    branchFilter = '', semesterFilter = null,
  } = filters;

  const normalizedUsn = (usnFilter || '').toUpperCase().trim();
  const normalizedName = toNameSearchPrefix(nameFilter || '');
  const hasNameFilter = Boolean(normalizedName);
  const hasUsnFilter = Boolean(normalizedUsn);
  const hasMin = sgpaMin !== null && sgpaMin !== '';
  const hasMax = sgpaMax !== null && sgpaMax !== '';

  function buildConstraints(cursor) {
    const c = [];
    if (branchFilter) c.push(where('branch', '==', branchFilter));
    if (semesterFilter !== null && semesterFilter !== '') c.push(where('semester', '==', Number(semesterFilter)));
    if (hasNameFilter) {
      c.push(where('name', '>=', normalizedName));
      c.push(where('name', '<=', `${normalizedName}${USN_PREFIX_END}`));
    }
    if (hasUsnFilter) {
      c.push(where('usn', '>=', normalizedUsn));
      c.push(where('usn', '<=', `${normalizedUsn}${USN_PREFIX_END}`));
    }
    if (hasMin) c.push(where('sgpa', '>=', Number(sgpaMin)));
    if (hasMax) c.push(where('sgpa', '<=', Number(sgpaMax)));
    if (hasNameFilter) c.push(orderBy('name', 'asc'));
    if (hasUsnFilter) c.push(orderBy('usn', 'asc'));
    if (hasMin || hasMax) c.push(orderBy('sgpa', 'asc'));
    c.push(orderBy('timestamp', 'desc'));
    if (cursor) c.push(startAfter(cursor));
    c.push(limit(ANALYTICS_PAGE_SIZE));
    return c;
  }

  const allRecords = [];
  let cursor = null;

  do {
    const constraints = buildConstraints(cursor);
    const q = query(collection(db, RESULTS_COL), ...constraints);
    const snap = await withTimeout(getDocs(q), 12000, null);
    if (!snap) break;

    snap.docs.forEach(d => allRecords.push({ id: d.id, ...d.data() }));
    cursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

    if (onProgress && snap.docs.length > 0) {
      onProgress(Math.min(95, Math.round((allRecords.length / (allRecords.length + 1)) * 100)));
    }

    if (snap.docs.length < ANALYTICS_PAGE_SIZE) break;
  } while (cursor);

  if (onProgress) onProgress(100);
  return allRecords;
}

// ─── Exam Session Manager ──────────────────────────────────────────────────────

const EXAM_SESSION_DOC = 'examSession';

/** Default session used if admin has not configured one */
const DEFAULT_EXAM_SESSION = {
  examTitle: 'SEE Examination',
  examMonth: 'June–July',
  examYear: '2026',
};

/**
 * Reads the current exam session from Firestore settings.
 * Returns the default if not configured.
 */
export async function getExamSession() {
  if (!db) return { ...DEFAULT_EXAM_SESSION };
  try {
    const ref = doc(db, SETTINGS_COL, EXAM_SESSION_DOC);
    const snap = await withTimeout(getDoc(ref), 5000, null);
    if (!snap || !snap.exists()) return { ...DEFAULT_EXAM_SESSION };
    return { ...DEFAULT_EXAM_SESSION, ...snap.data() };
  } catch {
    return { ...DEFAULT_EXAM_SESSION };
  }
}

/**
 * Saves the exam session configuration (admin only — enforced by Firestore rules).
 * @param {{ examTitle: string, examMonth: string, examYear: string }} session
 */
export async function saveExamSession(session) {
  if (!db) throw new Error('Firebase not initialized');
  const ref = doc(db, SETTINGS_COL, EXAM_SESSION_DOC);
  await setDoc(ref, {
    examTitle: (session.examTitle || DEFAULT_EXAM_SESSION.examTitle).trim(),
    examMonth: (session.examMonth || DEFAULT_EXAM_SESSION.examMonth).trim(),
    examYear:  (session.examYear  || DEFAULT_EXAM_SESSION.examYear).trim(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ─── Data Integrity Scanner ────────────────────────────────────────────────────

const USN_REGEX = /^4BD[0-9]{2}[A-Z]{2}[0-9]{3}$/;

/**
 * Scans all records for data quality issues:
 *  - Invalid USN format
 *  - Suspicious / fake / spam name (confidence-scored 0–100%)
 *  - Duplicate USN+semester combinations
 *  - Extreme SGPA values (> 10 or < 0)
 *
 * Returns a list of flagged records with confidence score and issue descriptions.
 * Reads from the shared analytics cache so repeated calls are cheap.
 */
export async function getDataIntegrityReport() {
  if (!db) return { flags: [], stats: {} };

  const records = await getAllResultsForAnalytics();
  const flags = [];
  const usnSemCount = {}; // USN+Sem → count for duplicate detection

  records.forEach(r => {
    const issues = [];

    // 1. Invalid USN format
    if (!r.usn || !USN_REGEX.test(r.usn)) {
      issues.push({ type: 'invalid_usn', message: `Invalid USN format: "${r.usn}"`, score: 90 });
    }

    // 2. Intelligent Multi-Signal Name Suspicion Analysis
    const name = (r.name || '').trim();
    const nameAnalysis = calculateNameSuspicionScore(name);

    if (nameAnalysis.category !== 'valid') {
      issues.push({
        type: nameAnalysis.category === 'suspicious' ? 'invalid_name' : 'review_name',
        category: nameAnalysis.category,
        score: nameAnalysis.score,
        message: `Name analysis (${nameAnalysis.score}% confidence): ${nameAnalysis.reasons.join(', ')}`,
      });
    }

    // 3. SGPA out of range
    if (typeof r.sgpa !== 'number' || r.sgpa < 0 || r.sgpa > 10) {
      issues.push({ type: 'invalid_sgpa', message: `SGPA out of range: ${r.sgpa}`, score: 85 });
    }

    // 4. Missing branch or semester
    if (!r.branch) issues.push({ type: 'missing_branch', message: 'Missing branch', score: 70 });
    if (!r.semester) issues.push({ type: 'missing_semester', message: 'Missing semester', score: 70 });

    // 5. Track USN+Sem duplicates
    const key = `${r.usn}_${r.semester}`;
    usnSemCount[key] = (usnSemCount[key] || 0) + 1;

    if (issues.length > 0) {
      const maxScore = Math.max(...issues.map(i => i.score || 50));
      flags.push({ ...r, issues, suspicionScore: maxScore, suspicionCategory: nameAnalysis.category });
    }
  });

  // Second pass: flag duplicates
  records.forEach(r => {
    const key = `${r.usn}_${r.semester}`;
    if (usnSemCount[key] > 1) {
      let existing = flags.find(f => f.id === r.id);
      if (!existing) {
        existing = { ...r, issues: [], suspicionScore: 75, suspicionCategory: 'needs_review' };
        flags.push(existing);
      }
      existing.issues.push({
        type: 'duplicate',
        message: `Duplicate USN+Semester entry (${usnSemCount[key]} records)`,
        score: 75,
      });
    }
  });

  // Summary stats
  const stats = {
    total: records.length,
    flagged: flags.length,
    suspiciousNames: flags.filter(f => f.issues.some(i => i.type === 'invalid_name')).length,
    reviewNames: flags.filter(f => f.issues.some(i => i.type === 'review_name')).length,
    invalidUSNs: flags.filter(f => f.issues.some(i => i.type === 'invalid_usn')).length,
    duplicates: flags.filter(f => f.issues.some(i => i.type === 'duplicate')).length,
    invalidSGPA: flags.filter(f => f.issues.some(i => i.type === 'invalid_sgpa')).length,
  };

  return { flags, stats };
}

/**
 * Permanently deletes a result record by ID (admin only).
 * Adjusts analytics counters.
 */
export async function deleteResultById(id) {
  // Alias for the existing deleteResult function with a clearer name
  return deleteResult(id);
}

// ─── Enterprise Security & RBAC Verification ─────────────────────────────────

/**
 * Verifies that a Firebase Auth user has an active document in `admins` collection.
 * Checks:
 *   1. Document exists (by UID or Email)
 *   2. active === true
 *   3. role is one of ['super_admin', 'admin', 'read_only']
 *
 * Updates lastLogin timestamp on success.
 *
 * @param {Object} user - Firebase Auth user object
 * @returns {Promise<{ authorized: boolean, adminRecord?: Object, reason?: string }>}
 */
export async function verifyAdminAccess(user) {
  if (!db || !user) return { authorized: false, reason: 'Unauthenticated user' };

  try {
    // 1. Check admins/{uid} document directly
    const directRef = doc(db, ADMINS_COL, user.uid);
    let snap = await withTimeout(getDoc(directRef), 5000, null);
    let data = snap && snap.exists() ? snap.data() : null;

    // 2. Fallback check by email if doc by UID does not exist
    if (!data && user.email) {
      const q = query(collection(db, ADMINS_COL), where('email', '==', user.email.toLowerCase().trim()), limit(1));
      const qSnap = await withTimeout(getDocs(q), 5000, null);
      if (qSnap && !qSnap.empty) {
        data = qSnap.docs[0].data();
      }
    }

    if (!data) {
      return { authorized: false, reason: 'No administrator profile found for this account.' };
    }

    if (data.active === false) {
      return { authorized: false, reason: 'This administrator account has been deactivated by Super Admin.' };
    }

    const validRoles = ['super_admin', 'admin', 'read_only'];
    const role = data.role || 'admin';
    if (!validRoles.includes(role)) {
      return { authorized: false, reason: 'Invalid administrator role assignment.' };
    }

    const adminRecord = {
      uid: user.uid,
      email: user.email,
      name: data.name || user.displayName || 'Administrator',
      role,
      active: true,
      createdAt: data.createdAt ?? null,
      lastLogin: new Date(),
    };

    // Update last login timestamp asynchronously
    setDoc(directRef, { lastLogin: serverTimestamp(), email: user.email.toLowerCase().trim() }, { merge: true }).catch(() => {});

    return { authorized: true, adminRecord };
  } catch (err) {
    console.error('[verifyAdminAccess]', err);
    return { authorized: false, reason: 'Database security check failed: ' + err.message };
  }
}

// ─── Security Audit Logging ───────────────────────────────────────────────────

/**
 * Creates an immutable audit log entry in `audit_logs` collection.
 */
export async function logAuditEvent({ action, actorUid = 'system', actorEmail = 'system', actorRole = 'system', details = {} }) {
  if (!db) return;
  try {
    const ref = doc(collection(db, AUDIT_LOGS_COL));
    await setDoc(ref, {
      action: String(action).toUpperCase(),
      actorUid: String(actorUid),
      actorEmail: String(actorEmail),
      actorRole: String(actorRole),
      details,
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    });
  } catch (err) {
    console.warn('[logAuditEvent] Audit log write failed:', err);
  }
}

/**
 * Fetches recent audit logs for Super Admin review.
 */
export async function getAuditLogs(limitCount = 50) {
  if (!db) return [];
  try {
    const q = query(collection(db, AUDIT_LOGS_COL), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await withTimeout(getDocs(q), 6000, null);
    if (!snap) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[getAuditLogs]', err);
    return [];
  }
}

// ─── Admin User Management (Super Admin only) ─────────────────────────────────

/**
 * Fetches all registered admin documents from `admins` collection.
 */
export async function getAdminUsers() {
  if (!db) return [];
  try {
    const q = query(collection(db, ADMINS_COL), orderBy('createdAt', 'desc'));
    const snap = await withTimeout(getDocs(q), 6000, null);
    if (!snap) return [];
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[getAdminUsers]', err);
    return [];
  }
}

/**
 * Super Admin function to provision an admin profile in Firestore.
 */
export async function createAdminRecord({ uid, email, name, role = 'admin' }) {
  if (!db || !uid || !email) throw new Error('UID and Email are required');
  const ref = doc(db, ADMINS_COL, uid);
  await setDoc(ref, {
    uid,
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role,
    active: true,
    createdAt: serverTimestamp(),
    lastLogin: null,
  }, { merge: true });
}

/**
 * Updates the role of an admin account.
 */
export async function updateAdminRole(uid, role) {
  if (!db || !uid) throw new Error('UID required');
  const validRoles = ['super_admin', 'admin', 'read_only'];
  if (!validRoles.includes(role)) throw new Error('Invalid role');

  const ref = doc(db, ADMINS_COL, uid);
  await setDoc(ref, { role, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Toggles an admin account's active state (Enable / Deactivate).
 */
export async function toggleAdminActive(uid, active) {
  if (!db || !uid) throw new Error('UID required');
  const ref = doc(db, ADMINS_COL, uid);
  await setDoc(ref, { active: Boolean(active), updatedAt: serverTimestamp() }, { merge: true });
}

