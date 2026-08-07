import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

/**
 * DuplicateConfirmModal
 *
 * Displayed when a student attempts to submit marks for a semester that already
 * has a saved result. Gives them the choice to update or keep the existing record.
 *
 * Props:
 *  existing   — the existing Firestore result document
 *  onUpdate   — callback when user confirms the update
 *  onCancel   — callback when user chooses to keep the old record
 */
export default function DuplicateConfirmModal({ existing, onUpdate, onCancel }) {
  if (!existing) return null;

  const submittedDate = existing.timestamp?.toDate
    ? existing.timestamp.toDate().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : 'Previously submitted';

  return (
    <AnimatePresence>
      <motion.div
        key="dup-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => e.target === e.currentTarget && onCancel()}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
      >
        <motion.div
          key="dup-card"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="card"
          style={{ padding: 28, width: '100%', maxWidth: 440 }}
          role="dialog"
          aria-modal="true"
          aria-label="Duplicate record confirmation"
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: '#fef9c3', border: '1px solid #fde68a',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AlertTriangle size={20} color="#d97706" />
            </div>
            <div>
              <p style={{ fontWeight: 800, color: '#0f172a', margin: '0 0 4px', fontSize: 15 }}>
                Record Already Exists
              </p>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                A result for <strong>Semester {existing.semester}</strong> already exists for{' '}
                <strong style={{ fontFamily: 'monospace' }}>{existing.usn}</strong>.
              </p>
            </div>
          </div>

          {/* Existing record summary */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '14px 16px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.07em', textTransform: 'uppercase', margin: 0 }}>
                Previous Submission
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '4px 0 2px' }}>
                {existing.name}
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                Semester {existing.semester} · {submittedDate}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#1d4ed8', margin: 0, lineHeight: 1 }}>
                {Number(existing.sgpa || 0).toFixed(2)}
              </p>
              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, margin: '3px 0 0', letterSpacing: '.06em' }}>
                PREV SGPA
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#475569', marginBottom: 22, lineHeight: 1.65 }}>
            Would you like to <strong>update</strong> this submission with your newly entered marks?
            This will <strong>permanently replace</strong> the previous record.
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              id="dup-cancel-btn"
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={onCancel}
            >
              <X size={14} /> Keep Old Record
            </button>
            <button
              id="dup-confirm-update-btn"
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={onUpdate}
            >
              <RefreshCw size={14} /> Update Record
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
