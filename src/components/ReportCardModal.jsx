import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Printer, X } from 'lucide-react';
import ReportCardPrint from './ReportCardPrint';

export default function ReportCardModal({ result, branchName, onClose, autoPrint = false, onAutoPrintComplete }) {
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('report-modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('report-modal-open');
    };
  }, [onClose]);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => {
      window.print();
      onAutoPrintComplete?.();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [autoPrint, onAutoPrintComplete]);

  const generatedAt = new Date();
  return (
    <AnimatePresence>
      {result && (
        <motion.div className="report-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => event.target === event.currentTarget && onClose()}>
          <motion.section className="report-modal-shell" role="dialog" aria-modal="true" aria-label="Student report card" initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}>
            <div className="report-modal-actions no-print">
              <p>Student Report Card</p>
              <div>
                <button type="button" className="btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
                <button type="button" className="report-close-button" onClick={onClose} aria-label="Close report card"><X size={18} /></button>
              </div>
            </div>
            <ReportCardPrint result={result} branchName={branchName} generatedAt={generatedAt} />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
