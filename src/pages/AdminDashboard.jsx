import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  LogOut, Users, BarChart2, TrendingUp,
  Download, Trash2, ChevronLeft, ChevronRight, RefreshCw,
  X, AlertTriangle, Activity, Database, BookOpen, Plus, Trash, Save, Award, AlertCircle, Eye, Printer,
  Settings, ShieldCheck, Check,
} from 'lucide-react';

import { auth } from '../firebase/config';
import {
  getPaginatedResults, deleteResult, subscribeToAnalytics,
  getSGPADistribution, getDailyUsage, checkAndSeedCurriculum,
  fetchCurriculum, saveCurriculum, getLeaderboardStats,
  getLeaderboardStatsBySemester,
} from '../firebase/services';

import { exportAllToCSV } from '../utils/exportCSV';
import {
  getExamSession, saveExamSession, getDataIntegrityReport,
  deleteResultById, exportAllResults,
  getAdminUsers, updateAdminRole, toggleAdminActive, createAdminRecord,
  getAuditLogs, logAuditEvent,
} from '../firebase/services';
import { TableSkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import SGPADistChart from '../components/charts/SGPADistChart';
import DailyUsageChart from '../components/charts/DailyUsageChart';
import { EXPLICIT_TEMPLATES, getExplicitTemplateSubjects } from '../utils/curriculumTemplates';
import StudentSearch from '../components/StudentSearch';

const ReportCardModal = lazy(() => import('../components/ReportCardModal'));

// ─── ALL BIET Branches ────────────────────────────────────────────────────────
export const BRANCHES = [
  // Computer Science & IT
  { id: 'cs-ds',  name: 'CS&E (Data Science)',             short: 'CS-DS',  dept: 'CS & IT' },
  { id: 'cse',    name: 'Computer Science & Engineering',   short: 'CSE',    dept: 'CS & IT' },
  { id: 'aiml',   name: 'AI & Machine Learning',            short: 'AIML',   dept: 'CS & IT' },
  { id: 'ise',    name: 'Information Science & Engineering', short: 'ISE',    dept: 'CS & IT' },
  { id: 'csd',    name: 'Computer Science & Design',        short: 'CSD',    dept: 'CS & IT' },
  { id: 'csbs',   name: 'Computer Science & Business Sys.', short: 'CSBS',   dept: 'CS & IT' },
  // Electronics
  { id: 'ece',    name: 'Electronics & Communication Engg', short: 'ECE',    dept: 'Electronics' },
  { id: 'eie',    name: 'Electronics & Instrumentation',    short: 'EIE',    dept: 'Electronics' },
  { id: 'vlsi',   name: 'Electronics (VLSI Design & Tech)', short: 'VLSI',   dept: 'Electronics' },
  // Electrical
  { id: 'eee',    name: 'Electrical & Electronics Engg',    short: 'EEE',    dept: 'Electrical' },
  // Mechanical
  { id: 'me',     name: 'Mechanical Engineering',           short: 'ME',     dept: 'Mechanical' },
  { id: 'auto',   name: 'Automobile Engineering',           short: 'AUTO',   dept: 'Mechanical' },
  { id: 'ipe',    name: 'Industrial & Production Engg',     short: 'IPE',    dept: 'Mechanical' },
  // Civil
  { id: 'cv',     name: 'Civil Engineering',                short: 'CIVIL',  dept: 'Civil' },
  { id: 'et',     name: 'Environmental Engineering',        short: 'ENV',    dept: 'Civil' },
  // Textile
  { id: 'tx',     name: 'Textile Technology',               short: 'TEXTILE',dept: 'Textile' },
  { id: 'txd',    name: 'Textile Design',                   short: 'TXD',    dept: 'Textile' },
  // Other
  { id: 'bt',     name: 'Biotechnology',                    short: 'BT',     dept: 'Science' },
  { id: 'ch',     name: 'Chemical Engineering',             short: 'CHEM',   dept: 'Science' },
];

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

// Subject type cycle: Theory → Lab → Non-Credit → Theory
const TYPE_CYCLE = ['theory', 'lab', 'non-credit'];

function getSubjectType(subject) {
  if (Number(subject.credits) === 0) return 'non-credit';
  if (subject.hasLab) return 'lab';
  return 'theory';
}

function applyType(subject, newType) {
  switch (newType) {
    case 'non-credit':
      return { ...subject, credits: 0, hasLab: false };
    case 'lab':
      return { ...subject, credits: subject.credits > 0 ? subject.credits : 1, hasLab: true };
    default: // theory
      return { ...subject, hasLab: false };
  }
}

const TYPE_STYLES = {
  'theory':     { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Theory' },
  'lab':        { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', label: 'Lab' },
  'non-credit': { bg: '#fafafa', color: '#94a3b8', border: '#e2e8f0', label: 'Non-Cr' },
};

const S = {
  page: { maxWidth: 1280, margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 },
  pageSub: { fontSize: 13, color: '#94a3b8', marginTop: 3 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 },
  sectionSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  filterRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 16 },
};

const DEBOUNCE_MS = 500;

export default function AdminDashboard({ adminProfile }) {
  const navigate = useNavigate();

  // Role permissions
  const role = adminProfile?.role || 'admin';
  const adminName = adminProfile?.name || 'Administrator';
  const adminEmail = adminProfile?.email || '';
  const adminUid = adminProfile?.uid || '';

  const isSuperAdmin = role === 'super_admin';
  const isReadOnly   = role === 'read_only';
  const canDelete    = isSuperAdmin;
  const canExport    = !isReadOnly;
  const canEdit      = !isReadOnly;

  // Active Tab: 'records', 'curriculum', 'analytics', 'settings', 'cleanup', 'users'
  const [activeTab, setActiveTab] = useState('records');

  const [analytics, setAnalytics]       = useState(null);
  const [visitorCount, setVisitorCount]  = useState(null);
  const [distData, setDistData]          = useState([]);
  const [dailyData, setDailyData]        = useState([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // Student Records Table State
  const [results, setResults]           = useState([]);
  const [tableLoading, setTableLoading]  = useState(true);
  const [lastDoc, setLastDoc]            = useState(null);
  const [hasMore, setHasMore]            = useState(false);
  const [pageStack, setPageStack]        = useState([]);
  const [currentPage, setCurrentPage]    = useState(1);

  // Records Filters
  const [nameSearch, setNameSearch] = useState('');
  const [usnSearch, setUsnSearch] = useState('');
  const [sgpaMin, setSgpaMin]     = useState('');
  const [sgpaMax, setSgpaMax]     = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const debounceRef = useRef(null);
  const recordsRequestRef = useRef(0);
  const paginationInFlightRef = useRef(false);

  // Deletions
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [autoPrintReport, setAutoPrintReport] = useState(false);

  // Curriculum Management Editor State
  const [curricBranch, setCurricBranch] = useState('cs-ds');
  const [curricSem, setCurricSem]       = useState(4);
  const [curricSubjects, setCurricSubjects] = useState([]);
  const [curricLoading, setCurricLoading]   = useState(false);
  const [curricSaving, setCurricSaving]     = useState(false);

  // SaaS Leaderboard & Advanced Analytics
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Semester filter for branch leaderboard: null = overall, 1-8 = specific semester
  const [leaderboardSemFilter, setLeaderboardSemFilter] = useState(null);
  const [semLeaderboard, setSemLeaderboard]             = useState(null);
  const [semLeaderboardLoading, setSemLeaderboardLoading] = useState(false);

  // Rows per page
  const PAGE_SIZE_OPTIONS = [20, 50, 100, 500, 1000, 2000, 'all'];
  const [pageSize, setPageSize] = useState(20);

  // Exam Session Manager state
  const [examSession, setExamSession]       = useState({ examTitle: 'SEE Examination', examMonth: 'June–July', examYear: '2026' });
  const [examSaving, setExamSaving]         = useState(false);
  const [examLoaded, setExamLoaded]         = useState(false);

  // Data Cleanup state
  const [cleanupReport, setCleanupReport]   = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(null);  // ID of record being deleted

  // Exporting state (for full-database export progress)
  const [exporting, setExporting]           = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Admin User Management & Audit Logs (Super Admin only)
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [auditLogsList, setAuditLogsList]   = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // Trigger self-seeding on launch (only if DB is empty)
  useEffect(() => {
    checkAndSeedCurriculum();
  }, []);

  // Real-time visitor counts & aggregates
  useEffect(() => {
    const unsub = subscribeToAnalytics(data => {
      setAnalytics(data);
      if (typeof data.totalVisitors === 'number') setVisitorCount(data.totalVisitors);
    });
    return () => unsub();
  }, []);

  // Standard Charts data
  useEffect(() => {
    let cancelled = false;
    setChartsLoading(true);
    Promise.allSettled([
      getSGPADistribution(),
      getDailyUsage(),
    ]).then(([distRes, dailyRes]) => {
      if (cancelled) return;
      setDistData(distRes.status === 'fulfilled' ? distRes.value : []);
      setDailyData(dailyRes.status === 'fulfilled' ? dailyRes.value : []);
      setChartsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Student records loading
  const loadPage = useCallback(async (filters = {}, cursor = null, pageSz = pageSize) => {
    const requestId = ++recordsRequestRef.current;
    setTableLoading(true);
    try {
      const { docs, lastDoc: ld, hasMore: hm } = await getPaginatedResults({
        lastDoc: cursor,
        nameFilter: filters.name ?? '',
        usnFilter: filters.usn ?? '',
        sgpaMin: filters.sgpaMin ?? null,
        sgpaMax: filters.sgpaMax ?? null,
        branchFilter: filters.branch ?? '',
        semesterFilter: filters.semester ?? null,
        pageSize: pageSz,
      });
      if (requestId !== recordsRequestRef.current) return false;
      setResults(docs); setLastDoc(ld); setHasMore(hm);
      return true;
    } catch (err) {
      if (requestId === recordsRequestRef.current) {
        toast.error('Failed to load records: ' + (err.message ?? 'Permission denied'));
      }
      return false;
    } finally {
      if (requestId === recordsRequestRef.current) setTableLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadPage(activeFilters, null);
    setCurrentPage(1);
    setPageStack([]);
  }, [activeFilters, loadPage]);

  // Debounce records query filters
  const applyFilters = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const f = {};
      if (nameSearch.trim()) f.name = nameSearch.trim();
      if (usnSearch.trim()) f.usn = usnSearch.trim().toUpperCase();
      if (sgpaMin !== '' && sgpaMax !== '') { f.sgpaMin = Number(sgpaMin); f.sgpaMax = Number(sgpaMax); }
      if (branchFilter) f.branch = branchFilter;
      if (semesterFilter) f.semester = Number(semesterFilter);
      setActiveFilters(f);
    }, DEBOUNCE_MS);
  }, [nameSearch, usnSearch, sgpaMin, sgpaMax, branchFilter, semesterFilter]);

  useEffect(() => {
    applyFilters();
    return () => clearTimeout(debounceRef.current);
  }, [applyFilters]);

  const clearFilters = () => {
    clearTimeout(debounceRef.current);
    setNameSearch('');
    setUsnSearch('');
    setSgpaMin('');
    setSgpaMax('');
    setBranchFilter('');
    setSemesterFilter('');
    setActiveFilters({});
  };

  const handleNextPage = async () => {
    if (!hasMore || !lastDoc || paginationInFlightRef.current) return;
    paginationInFlightRef.current = true;
    try {
      const loaded = await loadPage(activeFilters, lastDoc);
      if (loaded) {
        setPageStack(p => [...p, lastDoc]);
        setCurrentPage(p => p + 1);
      }
    } finally {
      paginationInFlightRef.current = false;
    }
  };
  const handlePrevPage = async () => {
    if (currentPage === 1 || paginationInFlightRef.current) return;
    const ns = [...pageStack]; ns.pop();
    paginationInFlightRef.current = true;
    try {
      const loaded = await loadPage(activeFilters, ns[ns.length - 1] ?? null);
      if (loaded) {
        setPageStack(ns);
        setCurrentPage(p => p - 1);
      }
    } finally {
      paginationInFlightRef.current = false;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setDeleting(true);
    try {
      await deleteResult(deleteTarget.id);
      await logAuditEvent({
        action: 'DELETE_STUDENT_RECORD',
        actorUid: adminUid,
        actorEmail: adminEmail,
        actorRole: role,
        details: { targetUsn: deleteTarget.usn, targetName: deleteTarget.name, targetId: deleteTarget.id },
      });
      setResults(p => p.filter(r => r.id !== deleteTarget.id));
      toast.success(`Deleted ${deleteTarget.usn}`);
      setDeleteTarget(null);
    } catch { toast.error('Delete failed — check admin permissions.'); }
    finally { setDeleting(false); }
  };

  const handleExport = async () => {
    if (isReadOnly) {
      toast.error('Read-Only administrators cannot export data');
      return;
    }
    if (exporting) return;
    setExporting(true);
    setExportProgress(0);
    const toastId = toast.loading('Fetching all records…');
    try {
      const count = await exportAllToCSV(
        (onProgress) => exportAllResults(activeFilters, onProgress),
        `biet_results_${Date.now()}.csv`,
        setExportProgress,
      );
      await logAuditEvent({
        action: 'EXPORT_STUDENT_DATA',
        actorUid: adminUid,
        actorEmail: adminEmail,
        actorRole: role,
        details: { recordCount: count, filters: activeFilters },
      });
      toast.success(`Exported ${count} records to CSV`, { id: toastId });
    } catch (err) {
      toast.error('Export failed: ' + (err.message ?? 'Unknown error'), { id: toastId });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  // ─── Exam Session Manager Handlers ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'settings' && !examLoaded) {
      getExamSession().then(s => {
        setExamSession(s);
        setExamLoaded(true);
      });
    }
  }, [activeTab, examLoaded]);

  const handleSaveExamSession = async () => {
    if (!canEdit) {
      toast.error('Read-only accounts cannot modify settings');
      return;
    }
    if (!examSession.examTitle || !examSession.examMonth || !examSession.examYear) {
      toast.error('All fields are required');
      return;
    }
    setExamSaving(true);
    try {
      await saveExamSession(examSession);
      await logAuditEvent({
        action: 'UPDATE_EXAM_SESSION',
        actorUid: adminUid,
        actorEmail: adminEmail,
        actorRole: role,
        details: examSession,
      });
      toast.success('Exam session saved! All report cards will update automatically.');
    } catch (err) {
      toast.error('Save failed: ' + (err.message ?? err.code));
    } finally {
      setExamSaving(false);
    }
  };

  // ─── Data Cleanup Handlers ───────────────────────────────────────────────────
  const runIntegrityScan = async () => {
    setCleanupLoading(true);
    setCleanupReport(null);
    try {
      const report = await getDataIntegrityReport();
      setCleanupReport(report);
      if (report.stats.flagged === 0) toast.success('Database is clean! No issues found.');
      else toast(`Found ${report.stats.flagged} flagged record(s).`, { icon: '⚠️' });
    } catch (err) {
      toast.error('Scan failed: ' + (err.message ?? err.code));
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleCleanupDelete = async (id, usn) => {
    if (!canDelete) {
      toast.error('Only Super Admins can delete records');
      return;
    }
    setCleanupDeleting(id);
    try {
      await deleteResultById(id);
      await logAuditEvent({
        action: 'DATA_CLEANUP_DELETE',
        actorUid: adminUid,
        actorEmail: adminEmail,
        actorRole: role,
        details: { targetId: id, targetUsn: usn },
      });
      setCleanupReport(prev => ({
        ...prev,
        flags: prev.flags.filter(f => f.id !== id),
        stats: { ...prev.stats, flagged: prev.stats.flagged - 1, total: prev.stats.total - 1 },
      }));
      setResults(prev => prev.filter(r => r.id !== id));
      toast.success(`Deleted ${usn}`);
    } catch {
      toast.error('Delete failed');
    } finally {
      setCleanupDeleting(null);
    }
  };

  const handleIgnoreFlag = (id) => {
    setCleanupReport(prev => ({
      ...prev,
      flags: prev.flags.filter(f => f.id !== id),
      stats: { ...prev.stats, flagged: Math.max(0, prev.stats.flagged - 1) },
    }));
    toast.success('Marked as valid');
  };

  // ─── Super Admin User & Audit Log Management ──────────────────────────────
  const loadAdminUsersAndAudit = useCallback(async () => {
    if (!isSuperAdmin) return;
    setAdminUsersLoading(true);
    setAuditLogsLoading(true);
    try {
      const [users, logs] = await Promise.all([getAdminUsers(), getAuditLogs(50)]);
      setAdminUsersList(users);
      setAuditLogsList(logs);
    } catch (err) {
      toast.error('Failed to load admin management data');
    } finally {
      setAdminUsersLoading(false);
      setAuditLogsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadAdminUsersAndAudit();
    }
  }, [activeTab, loadAdminUsersAndAudit]);

  const handleAdminRoleChange = async (targetUid, newRole) => {
    try {
      await updateAdminRole(targetUid, newRole);
      await logAuditEvent({
        action: 'UPDATE_ADMIN_ROLE',
        actorUid: adminUid,
        actorEmail: adminEmail,
        actorRole: role,
        details: { targetUid, newRole },
      });
      setAdminUsersList(prev => prev.map(u => u.uid === targetUid ? { ...u, role: newRole } : u));
      toast.success('Admin role updated');
    } catch (err) {
      toast.error('Role update failed');
    }
  };

  const handleToggleAdminActive = async (targetUid, currentActive) => {
    const nextActive = !currentActive;
    try {
      await toggleAdminActive(targetUid, nextActive);
      await logAuditEvent({
        action: nextActive ? 'ENABLE_ADMIN' : 'DEACTIVATE_ADMIN',
        actorUid: adminUid,
        actorEmail: adminEmail,
        actorRole: role,
        details: { targetUid, nextActive },
      });
      setAdminUsersList(prev => prev.map(u => u.uid === targetUid ? { ...u, active: nextActive } : u));
      toast.success(`Admin ${nextActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error('Status toggle failed');
    }
  };

  const getBranchName = useCallback((branchId) => (
    BRANCHES.find(branchItem => branchItem.id === branchId)?.name || branchId || 'CS&E (Data Science)'
  ), []);

  const openReport = (row, print = false) => {
    setReportTarget(row);
    setAutoPrintReport(print);
  };

  const closeReport = useCallback(() => {
    setReportTarget(null);
    setAutoPrintReport(false);
  }, []);

  const handleSignOut = async () => {
    await logAuditEvent({
      action: 'ADMIN_LOGOUT',
      actorUid: adminUid,
      actorEmail: adminEmail,
      actorRole: role,
    }).catch(() => {});
    await signOut(auth);
    navigate('/admin');
    toast.success('Signed out');
  };

  // ─── Curriculum Management Methods ──────────────────────────────────────────
  const loadCurriculum = useCallback(async () => {
    setCurricLoading(true);
    try {
      const list = await fetchCurriculum(curricBranch, curricSem);
      setCurricSubjects(list);
    } catch (err) {
      toast.error('Failed to load curriculum subjects');
    } finally {
      setCurricLoading(false);
    }
  }, [curricBranch, curricSem]);

  useEffect(() => {
    if (activeTab === 'curriculum') {
      loadCurriculum();
    }
  }, [activeTab, loadCurriculum]);

  const handleSubjectChange = (idx, field, value) => {
    setCurricSubjects(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // Cycle through: theory → lab → non-credit → theory
  const handleTypeCycle = (idx) => {
    setCurricSubjects(prev => {
      const copy = [...prev];
      const current = getSubjectType(copy[idx]);
      const currentIndex = TYPE_CYCLE.indexOf(current);
      const nextType = TYPE_CYCLE[(currentIndex + 1) % TYPE_CYCLE.length];
      copy[idx] = applyType(copy[idx], nextType);
      return copy;
    });
  };

  const handleAddSubject = () => {
    const tempKey = `sub_${Date.now()}`;
    setCurricSubjects(prev => [
      ...prev,
      { key: tempKey, code: '', label: '', alias: '', credits: 3, hasLab: false }
    ]);
  };

  const handleDeleteSubject = (idx) => {
    setCurricSubjects(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAutofill = (templateId) => {
    if (!templateId) return;
    const subjects = getExplicitTemplateSubjects(templateId, curricBranch, curricSem);
    if (subjects && subjects.length > 0) {
      const localSubjects = subjects.map(s => ({
        key: s.key || `sub_${s.code.replace(/\s+/g, '_').toLowerCase()}`,
        code: s.code,
        label: s.label,
        alias: s.alias || s.label,
        credits: s.credits,
        hasLab: Boolean(s.hasLab)
      }));
      setCurricSubjects(localSubjects);
      toast.success('Loaded template subjects! Click Save to write to Firestore.');
    } else {
      toast.error('No subjects found in this template.');
    }
  };

  const handleSaveCurriculum = async () => {
    // Validate: require code, label; credits must be a valid number
    const invalid = curricSubjects.some(s => !s.code.trim() || !s.label.trim() || isNaN(Number(s.credits)));
    if (invalid) {
      toast.error('Please fill Course Code, Course Title, and valid Credits for all rows.');
      return;
    }

    setCurricSaving(true);
    try {
      const payload = curricSubjects.map(s => ({
        key: s.key && !s.key.startsWith('sub_')
          ? s.key
          : `sub_${s.code.replace(/\s+/g, '_').toLowerCase()}`,
        code: s.code.trim().toUpperCase(),
        label: s.label.trim(),
        alias: (s.alias || '').trim() || s.label.trim(),
        credits: Number(s.credits),
        hasLab: Boolean(s.hasLab),
      }));
      await saveCurriculum(curricBranch, curricSem, payload);
      toast.success('Curriculum saved to Firestore!');
      // Bust cache so student page reloads fresh data
      localStorage.removeItem(`curriculum_${curricBranch}_${curricSem}`);
    } catch (err) {
      console.error('[SaveCurriculum]', err);
      toast.error(`Failed to save: ${err.message ?? 'Check Firestore permissions'}`);
    } finally {
      setCurricSaving(false);
    }
  };

  // ─── SaaS Analytics & Leaderboards ──────────────────────────────────────────
  const loadLeaderboards = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const stats = await getLeaderboardStats();
      setLeaderboardData(stats);
      // Pre-load the overall semester leaderboard (same cache hit)
      setSemLeaderboard(stats.branchLeaderboard);
    } catch (e) {
      toast.error('Failed to load performance leaderboards');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadLeaderboards();
    }
  }, [activeTab, loadLeaderboards]);

  // When semester filter changes, recompute leaderboard from the cache (no Firestore read)
  const handleSemFilterChange = useCallback(async (sem) => {
    setLeaderboardSemFilter(sem);
    setSemLeaderboardLoading(true);
    try {
      const filtered = await getLeaderboardStatsBySemester(sem); // null = overall
      setSemLeaderboard(filtered);
    } catch {
      toast.error('Failed to filter leaderboard');
    } finally {
      setSemLeaderboardLoading(false);
    }
  }, []);

  const hasFilters = Object.keys(activeFilters).length > 0;

  // Group branches by department for the dropdown
  const deptGroups = BRANCHES.reduce((acc, b) => {
    if (!acc[b.dept]) acc[b.dept] = [];
    acc[b.dept].push(b);
    return acc;
  }, {});

  return (
    <div style={S.page} className="admin-dashboard">

      {/* ── Page Header ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.pageTitle}>Admin Dashboard</h1>
          <p style={S.pageSub}>BIET SaaS Analytics &amp; Curriculum Control</p>
        </div>
        <button className="btn-secondary text-slate-700 hover:text-red-600 hover:border-red-300" onClick={handleSignOut} id="signout-btn">
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {/* ── SaaS Portal Navigation Tabs ── */}
      <div style={{
        display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0',
        marginBottom: 24, paddingBottom: 2, flexWrap: 'wrap'
      }} className="no-print">
        {[
          { id: 'records',    icon: <Database size={15} />,   label: 'Student Records' },
          { id: 'curriculum', icon: <BookOpen size={15} />,   label: 'Curriculum Manager' },
          { id: 'analytics',  icon: <BarChart2 size={15} />,  label: 'SaaS Leaderboards' },
          { id: 'settings',   icon: <Settings size={15} />,   label: 'Exam Session' },
          { id: 'cleanup',    icon: <ShieldCheck size={15} />, label: 'Data Cleanup' },
          ...(isSuperAdmin ? [{ id: 'users', icon: <Users size={15} />, label: 'Manage Admins' }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              borderBottom: activeTab === tab.id ? '2.5px solid #2563eb' : '2.5px solid transparent',
              color: activeTab === tab.id ? '#2563eb' : '#64748b', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: STUDENT RECORDS ─── */}
      {activeTab === 'records' && (
        <div>
          {/* Metric Aggregations */}
          <div style={S.grid3}>
            <MetricCard
              icon={<Users size={20} />} iconColor="#3b82f6" iconBg="#eff6ff"
              label="Total Visitors"
              value={visitorCount ?? '—'}
              loading={visitorCount === null}
            />
            <MetricCard
              icon={<BarChart2 size={20} />} iconColor="#14b8a6" iconBg="#f0fdfa"
              label="Total Calculations"
              value={analytics?.totalCalculations ?? '—'}
              loading={analytics === null}
            />
            <MetricCard
              icon={<TrendingUp size={20} />} iconColor="#6366f1" iconBg="#eef2ff"
              label="Average SGPA"
              value={analytics ? `${analytics.avgSGPA.toFixed(2)} / 10` : '—'}
              sub={analytics ? `From ${analytics.totalCalculations} submissions` : ''}
              loading={analytics === null}
            />
          </div>

          {/* Standard Chart Section */}
          <div style={S.grid2}>
            <div className="card" style={{ padding: 24 }}>
              <p style={S.sectionTitle}>SGPA Distribution</p>
              <p style={S.sectionSub}>All submissions</p>
              <div style={{ marginTop: 16 }}>
                {chartsLoading ? <ChartSkeleton /> : <SGPADistChart data={distData} />}
              </div>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <p style={S.sectionTitle}>Daily Calculations</p>
              <p style={S.sectionSub}>Last 7 days</p>
              <div style={{ marginTop: 16 }}>
                {chartsLoading ? <ChartSkeleton /> : <DailyUsageChart data={dailyData} />}
              </div>
            </div>
          </div>

          {/* Paginated Results Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={S.sectionTitle}>Student Records</p>
                  {hasFilters && <p style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>Filters active</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  {/* Rows Per Page Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                    <span>Rows:</span>
                    <select
                      id="rows-per-page-select"
                      className="input-field"
                      style={{ padding: '5px 8px', fontSize: 12, cursor: 'pointer', appearance: 'auto', width: 'auto' }}
                      value={pageSize}
                      onChange={e => {
                        const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setPageSize(val);
                        loadPage(activeFilters, null, val);
                        setCurrentPage(1);
                        setPageStack([]);
                      }}
                    >
                      {PAGE_SIZE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>
                          {opt === 'all' ? 'All Records' : `${opt} / page`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button id="refresh-btn" className="btn-secondary" style={{ padding: '7px 12px' }}
                    onClick={() => loadPage(activeFilters, null)}>
                    <RefreshCw size={14} />
                  </button>
                  <button id="export-btn" className="btn-secondary" onClick={handleExport} disabled={exporting}>
                    <Download size={14} /> {exporting ? `Exporting (${exportProgress}%)` : 'Export CSV (All)'}
                  </button>
                </div>
              </div>

              {/* Enhanced Dashboard Filters */}
              <div style={S.filterRow}>
                <StudentSearch
                  nameSearch={nameSearch}
                  usnSearch={usnSearch}
                  onNameChange={setNameSearch}
                  onUsnChange={setUsnSearch}
                />
                <div>
                  <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    className="input-field"
                    style={{ fontSize: 13, padding: '7px 10px', width: 180, cursor: 'pointer', appearance: 'auto' }}
                  >
                    <option value="">All Branches</option>
                    {Object.entries(deptGroups).map(([dept, branches]) => (
                      <optgroup key={dept} label={dept}>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={semesterFilter}
                    onChange={e => setSemesterFilter(e.target.value)}
                    className="input-field"
                    style={{ fontSize: 13, padding: '7px 10px', width: 130, cursor: 'pointer', appearance: 'auto' }}
                  >
                    <option value="">All Semesters</option>
                    {SEMESTERS.map(s => (
                      <option key={s} value={s}>{s}{s === 1 ? 'st' : s === 2 ? 'nd' : s === 3 ? 'rd' : 'th'} Semester</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input id="sgpa-min" type="number" min="0" max="10" step="0.1" placeholder="Min"
                    value={sgpaMin} onChange={e => setSgpaMin(e.target.value)}
                    className="input-field" style={{ width: 64, textAlign: 'center', fontSize: 13, padding: '8px 8px' }} />
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>–</span>
                  <input id="sgpa-max" type="number" min="0" max="10" step="0.1" placeholder="Max"
                    value={sgpaMax} onChange={e => setSgpaMax(e.target.value)}
                    className="input-field" style={{ width: 64, textAlign: 'center', fontSize: 13, padding: '8px 8px' }} />
                </div>
                {hasFilters && (
                  <button className="btn-danger" style={{ padding: '7px 12px', fontSize: 12 }} onClick={clearFilters}>
                    <X size={12} /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* Records List Table */}
            {tableLoading ? (
              <div style={{ padding: 24 }}><TableSkeleton rows={5} /></div>
            ) : results.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Activity size={32} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
                <p style={{ color: '#94a3b8', fontSize: 14 }}>
                  {hasFilters ? 'No records match your filters' : 'No records yet — calculate a result to see it here'}
                </p>
                {hasFilters && (
                  <button onClick={clearFilters} style={{ color: '#3b82f6', fontSize: 13, marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>USN</th>
                      <th>Branch / Sem</th>
                      <th style={{ textAlign: 'center' }}>SGPA</th>
                      <th>Submitted At</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, idx) => (
                      <tr key={row.id}>
                        <td style={{ color: '#94a3b8', fontSize: 12, width: 40 }}>
                          {(currentPage - 1) * 20 + idx + 1}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{row.name}</span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: 5 }}>
                            {row.usn}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                              {BRANCHES.find(b => b.id === row.branch)?.short || row.branch || 'CS-DS'}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' }}>
                              Sem {row.semester || 4}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <SGPABadge sgpa={row.sgpa} />
                        </td>
                        <td style={{ color: '#64748b', fontSize: 13 }}>
                          {row.timestamp?.toDate
                            ? row.timestamp.toDate().toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="record-actions">
                            <button className="record-action view" onClick={() => openReport(row)} title={`View ${row.name}'s report`}><Eye size={14} /> View</button>
                            <button className="record-action print" onClick={() => openReport(row, true)} title={`Print ${row.name}'s report`}><Printer size={14} /> Print</button>
                            <button className="btn-danger" onClick={() => setDeleteTarget(row)}><Trash2 size={13} /> Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!tableLoading && results.length > 0 && (
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Page {currentPage}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button id="prev-page-btn" className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }}
                    onClick={handlePrevPage} disabled={currentPage === 1}>
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <button id="next-page-btn" className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }}
                    onClick={handleNextPage} disabled={!hasMore}>
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: CURRICULUM MANAGER ─── */}
      {activeTab === 'curriculum' && (
        <div className="card" style={{ padding: 24 }}>
          {/* Class Selectors & Control Action bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9', paddingBottom: 20, marginBottom: 20,
            flexWrap: 'wrap', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label className="form-label" htmlFor="curric-branch-select">Target Branch</label>
                <select
                  id="curric-branch-select"
                  className="input-field"
                  value={curricBranch}
                  onChange={e => setCurricBranch(e.target.value)}
                  style={{ width: 240, fontSize: 14, cursor: 'pointer', appearance: 'auto' }}
                >
                  {Object.entries(deptGroups).map(([dept, branches]) => (
                    <optgroup key={dept} label={dept}>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="curric-sem-select">Semester</label>
                <select
                  id="curric-sem-select"
                  className="input-field"
                  value={curricSem}
                  onChange={e => setCurricSem(Number(e.target.value))}
                  style={{ width: 140, fontSize: 14, cursor: 'pointer', appearance: 'auto' }}
                >
                  {SEMESTERS.map(s => (
                    <option key={s} value={s}>
                      {s}{s === 1 ? 'st' : s === 2 ? 'nd' : s === 3 ? 'rd' : 'th'} Semester
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={loadCurriculum}
                disabled={curricLoading}
                style={{ alignSelf: 'flex-end', fontSize: 13 }}
              >
                <RefreshCw size={13} /> Load
              </button>
              <div>
                <label className="form-label" htmlFor="curric-template-select" style={{ color: '#2563eb', fontWeight: 600 }}>Autofill Template</label>
                <select
                  id="curric-template-select"
                  className="input-field"
                  value=""
                  onChange={e => {
                    handleAutofill(e.target.value);
                    e.target.value = ""; // Reset dropdown after selection
                  }}
                  style={{ width: 280, fontSize: 14, cursor: 'pointer', appearance: 'auto', border: '1.5px dashed #3b82f6', color: '#2563eb', fontWeight: 600, background: '#f0fdfa' }}
                >
                  <option value="" style={{ color: '#64748b' }}>-- Select Predefined Template --</option>
                  {EXPLICIT_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id} style={{ color: '#0f172a' }}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary text-blue-600 border-blue-200"
                onClick={handleAddSubject}
                disabled={curricLoading || curricSaving}
              >
                <Plus size={15} /> Add Course
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveCurriculum}
                disabled={curricLoading || curricSaving || curricSubjects.length === 0}
                style={{ padding: '10px 20px' }}
              >
                {curricSaving ? (
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <Save size={15} />
                )}
                {curricSaving ? 'Saving…' : 'Save Curriculum'}
              </button>
            </div>
          </div>

          {/* Type legend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {Object.entries(TYPE_STYLES).map(([type, style]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: style.bg, color: style.color, border: `1px solid ${style.border}`
                }}>{style.label}</span>
                <span>= {type === 'non-credit' ? '0 credits, not counted in SGPA' : type === 'lab' ? 'practical/lab course' : 'lecture-based course'}</span>
              </div>
            ))}
            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>Click TYPE button to cycle: Theory → Lab → Non-Credit</span>
          </div>

          {/* Curriculum Spreadsheet Editor */}
          {curricLoading ? (
            <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Loading curriculum subjects...</p>
              </div>
            </div>
          ) : curricSubjects.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: 12 }}>
              <BookOpen size={32} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
              <p style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>
                No curriculum configured for this branch/semester yet.
              </p>
              <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
                Click <strong>Load</strong> to fetch from database, or <strong>Add Course</strong> to create one.
              </p>
              <button className="btn-secondary text-blue-600 border-blue-200" style={{ marginTop: 16 }} onClick={handleAddSubject}>
                <Plus size={15} /> Add First Course
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>Course Code</th>
                    <th style={{ width: '38%' }}>Course Title</th>
                    <th style={{ width: '16%' }}>Short Alias</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Credits</th>
                    <th style={{ width: '14%', textAlign: 'center' }}>Type</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {curricSubjects.map((sub, idx) => {
                    const subType = getSubjectType(sub);
                    const typeStyle = TYPE_STYLES[subType];
                    return (
                      <tr key={sub.key || idx}>
                        <td>
                          <input
                            type="text"
                            placeholder="BCSPCC401"
                            value={sub.code}
                            onChange={e => handleSubjectChange(idx, 'code', e.target.value)}
                            className="input-field font-mono"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Analysis and Design of Algorithms"
                            value={sub.label}
                            onChange={e => handleSubjectChange(idx, 'label', e.target.value)}
                            className="input-field"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="ADA"
                            value={sub.alias}
                            onChange={e => handleSubjectChange(idx, 'alias', e.target.value)}
                            className="input-field text-slate-500"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max="6"
                            placeholder="Cr"
                            value={sub.credits}
                            onChange={e => handleSubjectChange(idx, 'credits', e.target.value)}
                            className="input-field"
                            style={{ padding: '6px 6px', fontSize: 13, width: 60, textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {/* Click to cycle through Theory → Lab → Non-Credit */}
                          <button
                            type="button"
                            onClick={() => handleTypeCycle(idx)}
                            title="Click to change type"
                            style={{
                              padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                              fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                              background: typeStyle.bg,
                              color: typeStyle.color,
                              border: `1px solid ${typeStyle.border}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {typeStyle.label} ↻
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ padding: '6px 10px' }}
                            onClick={() => handleDeleteSubject(idx)}
                          >
                            <Trash size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer action */}
          {curricSubjects.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary text-blue-600 border-blue-200"
                onClick={handleAddSubject}
              >
                <Plus size={15} /> Add Course
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveCurriculum}
                disabled={curricSaving}
                style={{ padding: '10px 20px' }}
              >
                {curricSaving ? 'Saving…' : <><Save size={15} /> Save Curriculum</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: SAAS LEADERBOARDS & STATS ─── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
          {/* Branch Leaderboard */}
          <div className="card" style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 14 }}>
              <Award size={18} className="text-blue-600" />
              <p style={{ ...S.sectionTitle, fontSize: 16 }}>Branch Performance Leaderboard</p>
            </div>

            {/* Semester Filter Tabs */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>Filter by Semester</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[null, 1, 2, 3, 4, 5, 6, 7, 8].map(sem => {
                  const active = leaderboardSemFilter === sem;
                  return (
                    <button
                      key={sem ?? 'overall'}
                      id={`leaderboard-sem-${sem ?? 'overall'}`}
                      onClick={() => handleSemFilterChange(sem)}
                      disabled={analyticsLoading}
                      style={{
                        padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        border: active ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                        background: active ? '#eff6ff' : '#f8fafc',
                        color: active ? '#1d4ed8' : '#64748b',
                        cursor: analyticsLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {sem === null ? 'Overall' : `Sem ${sem}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard list */}
            {analyticsLoading || semLeaderboardLoading ? (
              <TableSkeleton rows={4} />
            ) : !semLeaderboard?.length ? (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                {leaderboardSemFilter !== null
                  ? `No submissions found for Semester ${leaderboardSemFilter}.`
                  : 'No submissions yet to compute standings.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {semLeaderboard.map((b, idx) => {
                  const details = BRANCHES.find(br => br.id === b.id);
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', minWidth: 22 }}>{idx + 1}.</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{details?.name || b.id}</span>
                          {medal && <span style={{ fontSize: 14 }}>{medal}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{b.submissions} sub{b.submissions !== 1 ? 's' : ''}</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#2563eb', minWidth: 52, textAlign: 'right' }}>{b.avg.toFixed(2)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(b.avg / 10) * 100}%` }}
                            transition={{ duration: 0.5, delay: idx * 0.04 }}
                            style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #6366f1)', borderRadius: 999 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Semester context label */}
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'center', fontWeight: 600 }}>
                  {leaderboardSemFilter === null
                    ? `Overall — all semesters combined`
                    : `Semester ${leaderboardSemFilter} rankings only`}
                </p>
              </div>
            )}
          </div>

          {/* Subject Analysis */}
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Top performing courses */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
                <TrendingUp size={18} className="text-emerald-600" />
                <p style={S.sectionTitle}>Top Scoring Courses</p>
              </div>
              {analyticsLoading ? (
                <TableSkeleton rows={3} />
              ) : !leaderboardData?.topPerformingSubjects?.length ? (
                <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Insufficient data.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {leaderboardData.topPerformingSubjects.map(sub => (
                    <div key={sub.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fdf9', borderRadius: 10, border: '1px solid #dcfce7' }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>
                          {sub.code}
                        </span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.label}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#166534' }}>{sub.avgGP.toFixed(2)} GP</span>
                        <p style={{ fontSize: 9, color: '#94a3b8', margin: '2px 0 0' }}>{sub.outstandingRate}% O Grade</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Challenging courses */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
                <AlertCircle size={18} className="text-red-500" />
                <p style={S.sectionTitle}>Most Challenging Courses (Highest Fails)</p>
              </div>
              {analyticsLoading ? (
                <TableSkeleton rows={3} />
              ) : !leaderboardData?.failedSubjects?.length ? (
                <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No failing grades reported yet! 🎉</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {leaderboardData.failedSubjects.map(sub => (
                    <div key={sub.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff5f5', borderRadius: 10, border: '1px solid #ffe3e3' }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#b91c1c', background: '#ffe3e3', padding: '1px 5px', borderRadius: 4 }}>
                          {sub.code}
                        </span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.label}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#991b1b' }}>{sub.fails} Failed</span>
                        <p style={{ fontSize: 9, color: '#fca5a5', fontWeight: 700, margin: '2px 0 0' }}>Fail rate: {sub.failRate}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: EXAM SESSION MANAGER ─── */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <Settings size={20} />
              </div>
              <div>
                <p style={{ ...S.sectionTitle, fontSize: 18, margin: 0 }}>Exam Session Configuration</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
                  Update the official examination title and date displayed on student report cards &amp; printouts.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="form-label" htmlFor="exam-title-input">Examination Title</label>
                <input
                  id="exam-title-input"
                  className="input-field"
                  placeholder="e.g. SEE Examination"
                  value={examSession.examTitle}
                  onChange={e => setExamSession(p => ({ ...p, examTitle: e.target.value }))}
                />
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>e.g., SEE Examination, Supplementary Examination, Autonomous End-Sem Exam</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label" htmlFor="exam-month-input">Exam Month / Duration</label>
                  <input
                    id="exam-month-input"
                    className="input-field"
                    placeholder="e.g. June–July"
                    value={examSession.examMonth}
                    onChange={e => setExamSession(p => ({ ...p, examMonth: e.target.value }))}
                  />
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>e.g., June–July, February–March, October</p>
                </div>
                <div>
                  <label className="form-label" htmlFor="exam-year-input">Academic Year</label>
                  <input
                    id="exam-year-input"
                    className="input-field"
                    placeholder="e.g. 2026"
                    value={examSession.examYear}
                    onChange={e => setExamSession(p => ({ ...p, examYear: e.target.value }))}
                  />
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>e.g., 2026, 2026–27</p>
                </div>
              </div>

              {/* Live Preview Card */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: 16, marginTop: 4,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.07em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  Live Preview (Report Card Title Line)
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', margin: 0, fontFamily: 'serif' }}>
                  Provisional Results of B.E. / B.Tech. {examSession.examTitle || 'SEE Examination'}, {examSession.examMonth || 'June–July'} {examSession.examYear || '2026'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                <button
                  id="save-exam-session-btn"
                  className="btn-primary"
                  onClick={handleSaveExamSession}
                  disabled={examSaving}
                  style={{ padding: '11px 28px' }}
                >
                  <Save size={16} /> {examSaving ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: DATA CLEANUP TOOLS ─── */}
      {activeTab === 'cleanup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p style={{ ...S.sectionTitle, fontSize: 18, margin: 0 }}>Data Integrity &amp; Cleanup Scanner</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
                    Scans all database records for fake names (e.g. &ldquo;Hsh&rdquo;, &ldquo;abc&rdquo;), invalid USNs, duplicate submissions, and out-of-range SGPAs.
                  </p>
                </div>
              </div>
              <button
                id="run-integrity-scan-btn"
                className="btn-primary"
                onClick={runIntegrityScan}
                disabled={cleanupLoading}
                style={{ padding: '11px 24px' }}
              >
                <RefreshCw size={15} className={cleanupLoading ? 'animate-spin' : ''} />
                {cleanupLoading ? 'Scanning Database…' : 'Run Integrity Scan'}
              </button>
            </div>

            {/* Scan Statistics Grid */}
            {cleanupReport && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 20 }}>
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{cleanupReport.stats.total}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total Records</p>
                </div>
                <div style={{ padding: 14, background: cleanupReport.stats.flagged > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: 10, border: `1px solid ${cleanupReport.stats.flagged > 0 ? '#fed7aa' : '#bbf7d0'}`, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: cleanupReport.stats.flagged > 0 ? '#c2410c' : '#166534' }}>{cleanupReport.stats.flagged}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: cleanupReport.stats.flagged > 0 ? '#c2410c' : '#166534', fontWeight: 600 }}>Flagged Issues</p>
                </div>
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{cleanupReport.stats.invalidNames}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Suspicious Names</p>
                </div>
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#d97706' }}>{cleanupReport.stats.invalidUSNs}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Invalid USNs</p>
                </div>
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{cleanupReport.stats.duplicates}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Duplicates</p>
                </div>
              </div>
            )}
          </div>

          {/* Flagged Records Table */}
          {cleanupReport && cleanupReport.flags.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fff7ed' }}>
                <p style={{ fontWeight: 700, color: '#9a3412', margin: 0, fontSize: 14 }}>
                  Flagged Records ({cleanupReport.flags.length}) — Review &amp; Clean
                </p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      <th style={{ padding: '12px 16px' }}>Student Name</th>
                      <th style={{ padding: '12px 16px' }}>USN</th>
                      <th style={{ padding: '12px 16px' }}>Sem</th>
                      <th style={{ padding: '12px 16px' }}>SGPA</th>
                      <th style={{ padding: '12px 16px' }}>Detected Issues</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleanupReport.flags.map(item => {
                      const isHighSuspicion = (item.suspicionScore || 0) >= 61;
                      const isReview = (item.suspicionScore || 0) >= 31 && (item.suspicionScore || 0) < 61;

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                            {item.name || '—'}
                            {(item.suspicionScore || 0) > 0 && (
                              <span style={{
                                display: 'inline-block', marginLeft: 8, padding: '2px 8px', borderRadius: 999,
                                fontSize: 10, fontWeight: 800,
                                background: isHighSuspicion ? '#fef2f2' : isReview ? '#fefce8' : '#f0fdf4',
                                color: isHighSuspicion ? '#dc2626' : isReview ? '#a16207' : '#166534',
                                border: `1px solid ${isHighSuspicion ? '#fecaca' : isReview ? '#fef08a' : '#bbf7d0'}`,
                              }}>
                                {isHighSuspicion ? `High Suspicion (${item.suspicionScore}%)` : isReview ? `Needs Review (${item.suspicionScore}%)` : 'Valid'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#475569' }}>{item.usn || '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b' }}>Sem {item.semester || '—'}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>{item.sgpa !== undefined ? Number(item.sgpa).toFixed(2) : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {item.issues.map((iss, idx) => (
                                <span key={idx} style={{
                                  padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  background: iss.type === 'invalid_name' ? '#fef2f2' : iss.type === 'duplicate' ? '#eff6ff' : '#fffbeb',
                                  color: iss.type === 'invalid_name' ? '#dc2626' : iss.type === 'duplicate' ? '#1d4ed8' : '#b45309',
                                  border: `1px solid ${iss.type === 'invalid_name' ? '#fecaca' : iss.type === 'duplicate' ? '#bfdbfe' : '#fde68a'}`,
                                }}>
                                  {iss.message}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                id={`cleanup-ignore-${item.id}`}
                                style={{
                                  padding: '5px 10px', borderRadius: 8, border: '1px solid #cbd5e1',
                                  background: '#fff', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }}
                                onClick={() => handleIgnoreFlag(item.id)}
                              >
                                Mark Valid
                              </button>
                              <button
                                id={`cleanup-delete-${item.id}`}
                                style={{
                                  padding: '5px 10px', borderRadius: 8, border: '1px solid #fecaca',
                                  background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700,
                                  cursor: cleanupDeleting === item.id ? 'not-allowed' : 'pointer',
                                }}
                                onClick={() => handleCleanupDelete(item.id, item.usn)}
                                disabled={cleanupDeleting === item.id || !canDelete}
                              >
                                <Trash size={12} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                                {cleanupDeleting === item.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Delete Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(15,23,42,0.45)',
              backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="card"
              style={{ padding: 24, width: '100%', maxWidth: 380 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={18} color="#dc2626" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: '#0f172a', margin: 0 }}>Delete Record</p>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>This cannot be undone</p>
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '10px 14px', marginBottom: 20 }}>
                <p style={{ fontWeight: 600, color: '#0f172a', margin: 0, fontSize: 14 }}>{deleteTarget.name}</p>
                <p style={{ fontFamily: 'monospace', color: '#64748b', margin: 0, fontSize: 12 }}>{deleteTarget.usn} · SGPA {deleteTarget.sgpa?.toFixed(2)}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
                <button id="confirm-delete-btn"
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: deleting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'Inter, sans-serif', background: deleting ? '#fca5a5' : '#dc2626', color: 'white', transition: 'all 0.2s' }}
                  onClick={confirmDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        {reportTarget && (
          <ReportCardModal
            result={reportTarget}
            branchName={getBranchName(reportTarget.branch)}
            onClose={closeReport}
            autoPrint={autoPrintReport}
            onAutoPrintComplete={() => setAutoPrintReport(false)}
          />
        )}
      </Suspense>
    </div>
  );
}

/* ── Sub-components ── */

function MetricCard({ icon, iconColor, iconBg, label, value, sub, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="card card-hover"
      style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 12, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        color: iconColor,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
        {loading ? (
          <div className="skeleton" style={{ height: 28, width: 80, marginTop: 4 }} />
        ) : (
          <p style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '2px 0 0', lineHeight: 1.1 }}>{value}</p>
        )}
        {sub && <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

function SGPABadge({ sgpa }) {
  const v = parseFloat(sgpa);
  const [bg, color] = v >= 8.5 ? ['#f0fdf4','#166534'] : v >= 7 ? ['#eff6ff','#1e40af'] : v >= 6 ? ['#fef9c3','#713f12'] : ['#fef2f2','#991b1b'];
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: bg, color }}>
      {v.toFixed(2)}
    </span>
  );
}
