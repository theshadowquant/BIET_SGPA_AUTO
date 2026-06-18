import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  LogOut, Users, BarChart2, TrendingUp, Search,
  Download, Trash2, ChevronLeft, ChevronRight, RefreshCw,
  X, AlertTriangle, Activity,
} from 'lucide-react';

import { auth } from '../firebase/config';
import {
  getPaginatedResults, deleteResult, subscribeToAnalytics,
  getSGPADistribution, getDailyUsage,
} from '../firebase/services';

import { exportToCSV } from '../utils/exportCSV';
import { TableSkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import SGPADistChart from '../components/charts/SGPADistChart';
import DailyUsageChart from '../components/charts/DailyUsageChart';

const S = {
  page: { maxWidth: 1280, margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 },
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

  const [analytics, setAnalytics]       = useState(null);
  const [visitorCount, setVisitorCount]  = useState(null);
  const [distData, setDistData]          = useState([]);
  const [dailyData, setDailyData]        = useState([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [results, setResults]           = useState([]);
  const [tableLoading, setTableLoading]  = useState(true);
  const [lastDoc, setLastDoc]            = useState(null);
  const [hasMore, setHasMore]            = useState(false);
  const [pageStack, setPageStack]        = useState([]);
  const [currentPage, setCurrentPage]    = useState(1);

  const [usnSearch, setUsnSearch] = useState('');
  const [sgpaMin, setSgpaMin]     = useState('');
  const [sgpaMax, setSgpaMax]     = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const debounceRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // Analytics: real-time listener fires in ~300ms without blocking anything
  useEffect(() => {
    const unsub = subscribeToAnalytics(data => {
      setAnalytics(data);
      // Visitor count lives in analytics doc — set it instantly from same snapshot
      if (typeof data.totalVisitors === 'number') setVisitorCount(data.totalVisitors);
    });
    return () => unsub();
  }, []);

  // Charts: load independently, won't block table or metric cards
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


  const loadPage = useCallback(async (filters = {}, cursor = null) => {
    setTableLoading(true);
    try {
      const { docs, lastDoc: ld, hasMore: hm } = await getPaginatedResults({
        lastDoc: cursor,
        usnFilter: filters.usn ?? '',
        sgpaMin: filters.sgpaMin ?? null,
        sgpaMax: filters.sgpaMax ?? null,
      });
      setResults(docs); setLastDoc(ld); setHasMore(hm);
    } catch (err) {
      toast.error('Failed to load records: ' + (err.message ?? 'Permission denied'));
    } finally { setTableLoading(false); }
  }, []);

  useEffect(() => { loadPage(activeFilters, null); setCurrentPage(1); setPageStack([]); }, [activeFilters, loadPage]);

  const applyFilters = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const f = {};
      if (usnSearch.trim()) f.usn = usnSearch.trim().toUpperCase();
      if (sgpaMin !== '' && sgpaMax !== '') { f.sgpaMin = Number(sgpaMin); f.sgpaMax = Number(sgpaMax); }
      setActiveFilters(f);
    }, DEBOUNCE_MS);
  }, [usnSearch, sgpaMin, sgpaMax]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const clearFilters = () => { setUsnSearch(''); setSgpaMin(''); setSgpaMax(''); setActiveFilters({}); };

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

  const hasFilters = Object.keys(activeFilters).length > 0;

  return (
    <div style={S.page}>

      {/* ── Page Header ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.pageTitle}>Admin Dashboard</h1>
          <p style={S.pageSub}>BIET Analytics &amp; Student Records</p>
        </div>
        <button className="btn-secondary" onClick={handleSignOut} id="signout-btn">
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {/* ── Metric Cards ── */}
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

      {/* ── Charts ── */}
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

      {/* ── Records Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>

        {/* Table Header */}
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

          {/* Filters */}
          <div style={S.filterRow}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                id="usn-search"
                placeholder="Search USN…"
                value={usnSearch}
                onChange={e => setUsnSearch(e.target.value.toUpperCase())}
                className="input-field"
                style={{ paddingLeft: 32, width: 160, fontSize: 13, padding: '8px 12px 8px 32px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input id="sgpa-min" type="number" min="0" max="10" step="0.1" placeholder="Min"
                value={sgpaMin} onChange={e => setSgpaMin(e.target.value)}
                className="input-field" style={{ width: 68, textAlign: 'center', fontSize: 13, padding: '8px 8px' }} />
              <span style={{ color: '#94a3b8', fontSize: 13 }}>–</span>
              <input id="sgpa-max" type="number" min="0" max="10" step="0.1" placeholder="Max"
                value={sgpaMax} onChange={e => setSgpaMax(e.target.value)}
                className="input-field" style={{ width: 68, textAlign: 'center', fontSize: 13, padding: '8px 8px' }} />
            </div>
            {hasFilters && (
              <button className="btn-danger" style={{ padding: '7px 12px', fontSize: 12 }} onClick={clearFilters}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Table Body */}
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

        {/* Pagination */}
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
