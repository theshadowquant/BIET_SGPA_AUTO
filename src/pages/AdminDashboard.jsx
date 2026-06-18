import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  LogOut, Users, BarChart2, TrendingUp, Search,
  Download, Trash2, ChevronLeft, ChevronRight, RefreshCw,
  X, AlertTriangle, Activity, Database, BookOpen, Plus, Trash, Save, Award, AlertCircle
} from 'lucide-react';

import { auth } from '../firebase/config';
import {
  getPaginatedResults, deleteResult, subscribeToAnalytics,
  getSGPADistribution, getDailyUsage, checkAndSeedCurriculum,
  fetchCurriculum, saveCurriculum, getLeaderboardStats
} from '../firebase/services';

import { exportToCSV } from '../utils/exportCSV';
import { TableSkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import SGPADistChart from '../components/charts/SGPADistChart';
import DailyUsageChart from '../components/charts/DailyUsageChart';

const BRANCHES = [
  { id: 'cs-ds', name: 'CS&E (Data Science)', short: 'CS-DS' },
  { id: 'cse',   name: 'Computer Science & Engineering', short: 'CSE' },
  { id: 'aiml',  name: 'AI & Machine Learning', short: 'AIML' },
  { id: 'ise',   name: 'Information Science & Engineering', short: 'ISE' },
  { id: 'csd',   name: 'Computer Science & Design', short: 'CSD' },
];

const SEMESTERS = [3, 4, 5, 6];

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

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Active Tab: 'records', 'curriculum', 'analytics'
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
  const [usnSearch, setUsnSearch] = useState('');
  const [sgpaMin, setSgpaMin]     = useState('');
  const [sgpaMax, setSgpaMax]     = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const debounceRef = useRef(null);

  // Deletions
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // Curriculum Management Editor State
  const [curricBranch, setCurricBranch] = useState('cs-ds');
  const [curricSem, setCurricSem]       = useState(4);
  const [curricSubjects, setCurricSubjects] = useState([]);
  const [curricLoading, setCurricLoading]   = useState(false);
  const [curricSaving, setCurricSaving]     = useState(false);

  // SaaS Leaderboard & Advanced Analytics
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Trigger self-seeding on launch
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
  const loadPage = useCallback(async (filters = {}, cursor = null) => {
    setTableLoading(true);
    try {
      const { docs, lastDoc: ld, hasMore: hm } = await getPaginatedResults({
        lastDoc: cursor,
        usnFilter: filters.usn ?? '',
        sgpaMin: filters.sgpaMin ?? null,
        sgpaMax: filters.sgpaMax ?? null,
        branchFilter: filters.branch ?? '',
        semesterFilter: filters.semester ?? null,
      });
      setResults(docs); setLastDoc(ld); setHasMore(hm);
    } catch (err) {
      toast.error('Failed to load records: ' + (err.message ?? 'Permission denied'));
    } finally { setTableLoading(false); }
  }, []);

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
      if (usnSearch.trim()) f.usn = usnSearch.trim().toUpperCase();
      if (sgpaMin !== '' && sgpaMax !== '') { f.sgpaMin = Number(sgpaMin); f.sgpaMax = Number(sgpaMax); }
      if (branchFilter) f.branch = branchFilter;
      if (semesterFilter) f.semester = Number(semesterFilter);
      setActiveFilters(f);
    }, DEBOUNCE_MS);
  }, [usnSearch, sgpaMin, sgpaMax, branchFilter, semesterFilter]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const clearFilters = () => {
    setUsnSearch('');
    setSgpaMin('');
    setSgpaMax('');
    setBranchFilter('');
    setSemesterFilter('');
    setActiveFilters({});
  };

  const handleNextPage = () => {
    setPageStack(p => [...p, lastDoc]);
    loadPage(activeFilters, lastDoc);
    setCurrentPage(p => p + 1);
  };
  const handlePrevPage = () => {
    const ns = [...pageStack]; ns.pop();
    setPageStack(ns);
    loadPage(activeFilters, ns[ns.length - 1] ?? null);
    setCurrentPage(p => p - 1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteResult(deleteTarget.id);
      setResults(p => p.filter(r => r.id !== deleteTarget.id));
      toast.success(`Deleted ${deleteTarget.usn}`);
      setDeleteTarget(null);
    } catch { toast.error('Delete failed — check admin permissions.'); }
    finally { setDeleting(false); }
  };

  const handleExport = () => {
    if (!results.length) { toast.error('No records to export'); return; }
    exportToCSV(results, `biet_results_p${currentPage}.csv`);
    toast.success('CSV exported');
  };

  const handleSignOut = async () => {
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

  const handleLabToggle = (idx) => {
    setCurricSubjects(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], hasLab: !copy[idx].hasLab };
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

  const handleSaveCurriculum = async () => {
    const invalid = curricSubjects.some(s => !s.code.trim() || !s.label.trim() || isNaN(Number(s.credits)));
    if (invalid) {
      toast.error('Please enter Course Code, Course Title, and valid Credits for all rows.');
      return;
    }

    setCurricSaving(true);
    try {
      const payload = curricSubjects.map(s => ({
        key: s.key.startsWith('sub_') ? `sub_${s.code.replace(/\s+/g, '_').toLowerCase()}` : s.key,
        code: s.code.trim().toUpperCase(),
        label: s.label.trim(),
        alias: s.alias.trim() || s.label.trim(),
        credits: Number(s.credits),
        hasLab: Boolean(s.hasLab),
      }));
      await saveCurriculum(curricBranch, curricSem, payload);
      toast.success('Curriculum updated successfully on Firestore!');
      // Clear localStorage cache so the updates are fetched live on the homepage
      localStorage.removeItem(`curriculum_${curricBranch}_${curricSem}`);
    } catch (err) {
      toast.error('Failed to update curriculum');
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

  const hasFilters = Object.keys(activeFilters).length > 0;

  return (
    <div style={S.page}>

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
        <button
          onClick={() => setActiveTab('records')}
          style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, borderBottom: activeTab === 'records' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === 'records' ? '#2563eb' : '#64748b', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <Database size={15} /> Student Records
        </button>
        <button
          onClick={() => setActiveTab('curriculum')}
          style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, borderBottom: activeTab === 'curriculum' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === 'curriculum' ? '#2563eb' : '#64748b', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <BookOpen size={15} /> Curriculum Manager
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, borderBottom: activeTab === 'analytics' ? '2.5px solid #2563eb' : '2.5px solid transparent',
            color: activeTab === 'analytics' ? '#2563eb' : '#64748b', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <BarChart2 size={15} /> SaaS Leaderboards
        </button>
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
              <p style={S.sectionSub}>Last 200 submissions</p>
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
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <button id="refresh-btn" className="btn-secondary" style={{ padding: '7px 12px' }}
                    onClick={() => loadPage(activeFilters, null)}>
                    <RefreshCw size={14} />
                  </button>
                  <button id="export-btn" className="btn-secondary" onClick={handleExport}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Enhanced Dashboard Filters */}
              <div style={S.filterRow}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    id="usn-search"
                    placeholder="Search USN…"
                    value={usnSearch}
                    onChange={e => setUsnSearch(e.target.value.toUpperCase())}
                    className="input-field"
                    style={{ paddingLeft: 32, width: 140, fontSize: 13, padding: '8px 12px 8px 32px' }}
                  />
                </div>
                <div>
                  <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    className="input-field"
                    style={{ fontSize: 13, padding: '7px 10px', width: 160, cursor: 'pointer', appearance: 'auto' }}
                  >
                    <option value="">All Branches</option>
                    {BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
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
                      <option key={s} value={s}>{s}th Semester</option>
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
                          <button className="btn-danger" onClick={() => setDeleteTarget(row)}>
                            <Trash2 size={13} /> Delete
                          </button>
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

      {/* ─── TAB 2: CURRICULUM MANAGER (SaaS spreadsheet style config) ─── */}
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
                  style={{ width: 200, fontSize: 14, cursor: 'pointer', appearance: 'auto' }}
                >
                  {BRANCHES.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
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
                  style={{ width: 130, fontSize: 14, cursor: 'pointer', appearance: 'auto' }}
                >
                  {SEMESTERS.map(s => (
                    <option key={s} value={s}>{s}th Semester</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
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
                No curriculum configured for this semester yet.
              </p>
              <button className="btn-secondary text-blue-600 border-blue-200 mt-4" onClick={handleAddSubject}>
                <Plus size={15} /> Add First Course
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>Course Code</th>
                    <th style={{ width: '40%' }}>Course Title</th>
                    <th style={{ width: '18%' }}>Short Alias</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>Credits</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Type</th>
                    <th style={{ width: '8%', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {curricSubjects.map((sub, idx) => (
                    <tr key={sub.key}>
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
                          placeholder="Credits"
                          value={sub.credits}
                          onChange={e => handleSubjectChange(idx, 'credits', e.target.value)}
                          className="input-field"
                          style={{ padding: '6px 6px', fontSize: 13, width: 60, textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleLabToggle(idx)}
                          disabled={Number(sub.credits) === 0}
                          style={{
                            padding: '4px 10px', border: 'none', borderRadius: 6, cursor: Number(sub.credits) === 0 ? 'not-allowed' : 'pointer',
                            fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                            background: Number(sub.credits) === 0 ? '#fafafa' : sub.hasLab ? '#f0fdf4' : '#eff6ff',
                            color: Number(sub.credits) === 0 ? '#94a3b8' : sub.hasLab ? '#166534' : '#2563eb',
                            border: Number(sub.credits) === 0 ? '1px solid #e2e8f0' : sub.hasLab ? '1px solid #bbf7d0' : '1px solid #bfdbfe'
                          }}
                        >
                          {Number(sub.credits) === 0 ? 'Non-Cr' : sub.hasLab ? 'Lab' : 'Theory'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-danger hover:bg-red-500 hover:text-white"
                          style={{ padding: '6px 10px' }}
                          onClick={() => handleDeleteSubject(idx)}
                        >
                          <Trash size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: SAAS LEADERBOARDS & STATS ─── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
          {/* Branch Leaderboard */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
              <Award size={18} className="text-blue-600" />
              <p style={{ ...S.sectionTitle, fontSize: 16 }}>Branch performance Leaderboard</p>
            </div>
            {analyticsLoading ? (
              <TableSkeleton rows={4} />
            ) : !leaderboardData?.branchLeaderboard?.length ? (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No submissions yet to compute standings.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {leaderboardData.branchLeaderboard.map((b, idx) => {
                  const details = BRANCHES.find(br => br.id === b.id);
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                  return (
                    <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#334155', minWidth: 20 }}>{idx + 1}.</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{details?.name || b.id}</span>
                          <span style={{ fontSize: 14 }}>{medal}</span>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#2563eb' }}>{b.avg.toFixed(2)} GP</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #6366f1)', borderRadius: 999, width: `${(b.avg / 10) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{b.submissions} logs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Subject Analysis (Failed & Outstanding) */}
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

