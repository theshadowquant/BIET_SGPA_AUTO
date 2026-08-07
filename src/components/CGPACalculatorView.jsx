import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Calculator, Search, Printer, RotateCcw, BookOpen, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getStudentCGPA } from '../firebase/services';

const SEMESTER_NAMES = [
  '1st Semester',
  '2nd Semester',
  '3rd Semester',
  '4th Semester',
  '5th Semester',
  '6th Semester',
  '7th Semester',
  '8th Semester',
];

export default function CGPACalculatorView() {
  const [usn, setUsn]             = useState('');
  const [fetching, setFetching]   = useState(false);
  const [semSgpas, setSemSgpas]   = useState({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' });
  const [cgpaResult, setCgpaResult] = useState(null);
  const reportRef = useRef(null);

  // Handle USN Auto Fetch from Firestore
  const handleAutoFetch = async () => {
    const trimmed = usn.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Please enter a USN to auto-fetch results');
      return;
    }
    if (!/^4BD\d{2}[A-Z]{2}\d{3}$/.test(trimmed)) {
      toast.error('Please enter a valid BIET USN (e.g. 4BD24CD001)');
      return;
    }

    setFetching(true);
    try {
      const data = await getStudentCGPA(trimmed);
      if (data && data.semesterBreakdown && data.semesterBreakdown.length > 0) {
        const newSgpas = { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' };
        data.semesterBreakdown.forEach(sem => {
          newSgpas[sem.semester] = String(sem.sgpa);
        });
        setSemSgpas(newSgpas);
        toast.success(`Fetched ${data.semesterBreakdown.length} semester record(s) for ${trimmed}!`);
        calculateFromSgpas(newSgpas, trimmed);
      } else {
        toast('No saved semester records found for this USN. Enter SGPAs manually below.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not fetch USN records. Enter SGPAs manually.');
    } finally {
      setFetching(false);
    }
  };

  const handleSgpaChange = (semNum, val) => {
    // Allow empty string, numbers, or decimal numbers up to 10
    if (val !== '' && (isNaN(Number(val)) || Number(val) < 0 || Number(val) > 10)) {
      return;
    }
    setSemSgpas(prev => ({ ...prev, [semNum]: val }));
  };

  const calculateFromSgpas = (sgpaMap = semSgpas, usnCode = usn) => {
    const validEntries = [];
    for (let sem = 1; sem <= 8; sem++) {
      const raw = sgpaMap[sem];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        const val = parseFloat(raw);
        if (!isNaN(val) && val >= 0 && val <= 10) {
          validEntries.push({ semester: sem, label: SEMESTER_NAMES[sem - 1], sgpa: val });
        }
      }
    }

    if (validEntries.length === 0) {
      toast.error('Please enter SGPA for at least one semester');
      return;
    }

    const sum = validEntries.reduce((acc, curr) => acc + curr.sgpa, 0);
    const finalCgpa = parseFloat((sum / validEntries.length).toFixed(2));
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    setCgpaResult({
      finalCgpa,
      entries: validEntries,
      dateStr: formattedDate,
      usn: usnCode.trim().toUpperCase(),
    });

    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleCalculate = (e) => {
    e.preventDefault();
    calculateFromSgpas();
  };

  const handleReset = () => {
    setSemSgpas({ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' });
    setCgpaResult(null);
    setUsn('');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      
      {/* ── Auto Fetch Banner ── */}
      <div className="card no-print" style={{ padding: 20, marginBottom: 20, background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%)', border: '1.5px solid #bfdbfe' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <Award size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#1e3a8a' }}>Auto-Fetch Saved Semester SGPAs</p>
              <p style={{ margin: 0, fontSize: 11, color: '#3b82f6' }}>Enter your USN to automatically populate your completed semester grades</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flex: '1 1 240px', maxWidth: 360 }}>
            <input
              id="cgpa-auto-usn"
              className="input-field"
              placeholder="e.g. 4BD24CD001"
              style={{ fontFamily: 'monospace', textTransform: 'uppercase', background: '#fff' }}
              value={usn}
              maxLength={10}
              onChange={e => setUsn(e.target.value.toUpperCase().replace(/\s/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleAutoFetch()}
            />
            <button
              id="auto-fetch-btn"
              className="btn-primary"
              onClick={handleAutoFetch}
              disabled={fetching}
              style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              {fetching ? 'Fetching…' : 'Fetch Results'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Manual 8-Semester Inputs Card (Replica of Screenshot 2) ── */}
      <div className="card no-print" style={{ padding: 28, marginBottom: 28 }}>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px', fontWeight: 500 }}>
          (Leave blank if you do not have SGPA for a semester)
        </p>

        <form onSubmit={handleCalculate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px 24px' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
              <div key={sem}>
                <label className="form-label" htmlFor={`sem-${sem}-sgpa`} style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6, display: 'block' }}>
                  {SEMESTER_NAMES[sem - 1]} SGPA
                </label>
                <input
                  id={`sem-${sem}-sgpa`}
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  className="input-field"
                  placeholder="e.g. 7.50"
                  value={semSgpas[sem]}
                  onChange={e => handleSgpaChange(sem, e.target.value)}
                  style={{
                    fontSize: 14,
                    padding: '11px 14px',
                    borderColor: semSgpas[sem] !== '' ? '#059669' : '#cbd5e1',
                    background: semSgpas[sem] !== '' ? '#f0fdf4' : '#ffffff',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button
              id="calculate-cgpa-btn"
              type="submit"
              style={{
                padding: '12px 42px',
                borderRadius: 12,
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(5,150,105,0.25)',
                transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Calculator size={18} />
              Calculate CGPA
            </button>
          </div>
        </form>
      </div>

      {/* ── CGPA Result & Print Report Card (Replica of Screenshot 3) ── */}
      {cgpaResult && (
        <motion.div
          ref={reportRef}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="cgpa-report-card"
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
            padding: 28,
            marginBottom: 32,
          }}
        >
          {/* Header Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              BIETDavangere.ac.in
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '.04em' }}>
              BIET / VTU CGPA Report
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
              {cgpaResult.dateStr}
            </div>
          </div>

          {/* FINAL CGPA Large Callout */}
          <div style={{ textAlign: 'center', margin: '20px 0 24px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              FINAL CGPA
            </p>
            <p style={{ fontSize: 44, fontWeight: 900, color: '#059669', margin: 0, lineHeight: 1 }}>
              {cgpaResult.finalCgpa.toFixed(2)}
            </p>
            {cgpaResult.usn && (
              <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#334155', fontWeight: 700, margin: '8px 0 0' }}>
                USN: {cgpaResult.usn}
              </p>
            )}
          </div>

          {/* Semester Breakdown Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 700 }}>
                  <th style={{ padding: '12px 20px' }}>Semester</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>SGPA</th>
                </tr>
              </thead>
              <tbody>
                {cgpaResult.entries.map((item, idx) => (
                  <tr key={item.semester} style={{ borderBottom: idx < cgpaResult.entries.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '12px 20px', color: '#334155', fontWeight: 600 }}>{item.label}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: '#059669', fontFamily: 'monospace', fontSize: 15 }}>
                      {item.sgpa.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Print & Action Bar */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              id="print-cgpa-report-btn"
              onClick={handlePrint}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(5,150,105,0.2)',
              }}
            >
              <Printer size={15} /> Print CGPA Report
            </button>
            <button
              id="reset-cgpa-btn"
              onClick={handleReset}
              className="btn-secondary"
              style={{ padding: '10px 20px', fontSize: 14 }}
            >
              <RotateCcw size={15} /> Recalculate
            </button>
          </div>
        </motion.div>
      )}

      {/* Print CSS Rules for CGPA Report */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .cgpa-report-card, .cgpa-report-card * { visibility: visible !important; }
          .cgpa-report-card {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
