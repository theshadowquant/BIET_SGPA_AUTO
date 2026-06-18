import { motion } from 'framer-motion';
import { Trophy, AlertTriangle, TrendingUp, TrendingDown, Star } from 'lucide-react';

const SGPA_COLORS = {
  excellent: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: 'Excellent Performance' },
  good:      { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'Good Performance' },
  average:   { bg: '#fefce8', border: '#fde68a', text: '#92400e', label: 'Average Performance' },
  poor:      { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: 'Needs Improvement' },
};

function getSGPACategory(sgpa) {
  if (sgpa >= 8.5) return 'excellent';
  if (sgpa >= 7.0) return 'good';
  if (sgpa >= 6.0) return 'average';
  return 'poor';
}

function SGPARing({ sgpa }) {
  const pct = (sgpa / 10) * 100;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const cat = getSGPACategory(sgpa);
  const colors = {
    excellent: '#22c55e',
    good: '#3b82f6',
    average: '#f59e0b',
    poor: '#ef4444',
  };
  const color = colors[cat];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" className="rotate-[-90deg]">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <motion.circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-800 text-gray-900"
          style={{ fontWeight: 800 }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5, type: 'spring' }}
        >
          {sgpa.toFixed(2)}
        </motion.span>
        <span className="text-xs text-gray-500 font-medium">SGPA</span>
      </div>
    </div>
  );
}

export default function ResultCard({ result, studentName, usn }) {
  const { sgpa, hasF, strongSubjects, weakSubjects } = result;
  const cat = getSGPACategory(sgpa);
  const theme = SGPA_COLORS[cat];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="glass-card-dark overflow-hidden"
      id="result-card"
    >
      {/* Header banner */}
      <div
        className="px-6 py-4"
        style={{ background: `linear-gradient(135deg, ${theme.bg} 0%, white 100%)`, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Result Report</p>
            <h2 className="text-xl font-bold text-gray-900">{studentName}</h2>
            <p className="text-sm font-mono text-gray-500 mt-0.5">{usn}</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: theme.bg, color: theme.text, border: `1px solid ${theme.border}` }}
          >
            {cat === 'excellent' && <Star className="w-4 h-4 fill-current" />}
            {cat === 'good' && <TrendingUp className="w-4 h-4" />}
            {cat === 'average' && <TrendingUp className="w-4 h-4" />}
            {cat === 'poor' && <AlertTriangle className="w-4 h-4" />}
            {theme.label}
            {hasF && ' · Backlog'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* SGPA ring */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <SGPARing sgpa={sgpa} />
            <div className="text-center">
              <p className="text-xs text-gray-400 font-medium">Out of 10.00</p>
              {hasF && (
                <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Backlog(s) detected
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 w-full space-y-4">
            {/* Credit summary */}
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Total Credits" value={result.totalCredits} />
              <StatBox label="Weighted Points" value={result.totalWeightedPoints} />
              <StatBox label="SGPA" value={sgpa.toFixed(2)} highlight />
            </div>

            {/* Strong subjects */}
            {strongSubjects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-xl p-3.5"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
              >
                <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Strong Subjects
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {strongSubjects.map(s => (
                    <span key={s} className="badge badge-excellent" style={{ fontSize: '0.7rem' }}>{s}</span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Weak subjects */}
            {weakSubjects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
                className="rounded-xl p-3.5"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
              >
                <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Needs Attention
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {weakSubjects.map(s => (
                    <span key={s} className="badge badge-fail" style={{ fontSize: '0.7rem' }}>{s}</span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatBox({ label, value, highlight }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: highlight ? 'linear-gradient(135deg, #3b82f6, #14b8a6)' : '#f8fafc',
        border: highlight ? 'none' : '1px solid #e2e8f0',
      }}
    >
      <p className={`text-xl font-bold ${highlight ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: 800 }}>
        {value}
      </p>
      <p className={`text-xs mt-0.5 ${highlight ? 'text-blue-100' : 'text-gray-500'}`}>{label}</p>
    </div>
  );
}
