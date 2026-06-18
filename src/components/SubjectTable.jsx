import { motion } from 'framer-motion';
import { gradeClass } from '../utils/calculateSGPA';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const rowVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function SubjectTable({ breakdown }) {
  return (
    <motion.div
      className="glass-card overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
    >
      <div className="px-6 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
        <h3 className="font-bold text-gray-900">Subject-wise Breakdown</h3>
        <p className="text-xs text-gray-500 mt-0.5">Detailed grade analysis for all subjects</p>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th className="text-center">Credits</th>
              <th className="text-center">Marks</th>
              <th className="text-center">Grade</th>
              <th className="text-center">Grade Points</th>
              <th className="text-center">Contribution</th>
              <th className="text-center">Progress</th>
            </tr>
          </thead>
          <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
            {breakdown.map((row) => (
              <motion.tr key={row.key} variants={rowVariants}>
                <td>
                  <div className="flex items-start gap-2.5 py-1">
                    <div style={{ marginTop: 6 }}>
                      <StrengthDot strength={row.strength} excluded={row.excluded} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {row.code}
                        </span>
                        <span className="text-xs font-bold text-gray-400">
                          ({row.alias})
                        </span>
                        {row.excluded && (
                          <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                            (non-credit)
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-gray-800 text-sm leading-tight">
                        {row.label}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="text-center text-gray-600">{row.credits}</td>
                <td className="text-center font-semibold text-gray-900">{row.marks}</td>
                <td className="text-center">
                  <span className={`badge ${gradeClass(row.gradePoint)}`}>
                    {row.grade}
                  </span>
                </td>
                <td className="text-center">
                  <span
                    className="text-sm font-bold"
                    style={{ color: row.gradePoint === 0 ? '#ef4444' : '#1d4ed8' }}
                  >
                    {row.gradePoint}
                  </span>
                </td>
                <td className="text-center">
                  <span className="text-sm font-semibold text-gray-700">
                    {row.excluded ? '—' : row.contribution}
                  </span>
                </td>
                <td>
                  <MarksBar marks={row.marks} gradePoint={row.gradePoint} excluded={row.excluded} />
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.div>
  );
}

function StrengthDot({ strength, excluded }) {
  if (excluded) return <span className="w-2 h-2 rounded-full bg-gray-200 shrink-0" />;
  const colors = {
    strong:  '#22c55e',
    neutral: '#94a3b8',
    weak:    '#ef4444',
  };
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: colors[strength] ?? '#94a3b8' }}
    />
  );
}

function MarksBar({ marks, gradePoint, excluded }) {
  const pct = Math.min((marks / 100) * 100, 100);
  const color = excluded
    ? '#cbd5e1'
    : gradePoint >= 9
      ? '#22c55e'
      : gradePoint >= 7
        ? '#3b82f6'
        : gradePoint >= 6
          ? '#f59e0b'
          : '#ef4444';

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="progress-bar-wrapper flex-1">
        <motion.div
          className="progress-bar-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <span className="text-xs text-gray-400 w-7 text-right">{marks}%</span>
    </div>
  );
}
