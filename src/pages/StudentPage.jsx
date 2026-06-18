import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Calculator, Download, Printer, Share2, History,
  ChevronRight, RotateCcw, Clock, CheckCircle2,
} from 'lucide-react';

import SubjectForm from '../components/SubjectForm';
import ResultCard from '../components/ResultCard';
import SubjectTable from '../components/SubjectTable';

import { calculateSGPA, validateMarks } from '../utils/calculateSGPA';
import { checkRateLimit, recordSubmission, formatCooldown } from '../utils/rateLimit';
import { getOrCreateSession, getDeviceInfo, markSessionAsRecorded } from '../utils/sessionManager';
import { saveResult, getResultsByUSN, recordVisit, fetchCurriculum } from '../firebase/services';

const BRANCHES = [
  { id: 'cs-ds', name: 'CS&E (Data Science)' },
  { id: 'cse',   name: 'Computer Science & Engineering' },
  { id: 'aiml',  name: 'AI & Machine Learning' },
  { id: 'ise',   name: 'Information Science & Engineering' },
  { id: 'csd',   name: 'Computer Science & Design' },
];

const SEMESTERS = [3, 4, 5, 6];

const S = {
  page: { maxWidth: 860, margin: '0 auto', padding: '36px 20px' },
  hero: { textAlign: 'center', marginBottom: 36 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 14px', borderRadius: 999,
    fontSize: 12, fontWeight: 600,
    background: '#eff6ff', color: '#2563eb',
    border: '1px solid #bfdbfe', marginBottom: 16,
  },
  h1: { fontSize: 34, fontWeight: 900, color: '#0f172a', margin: '0 0 12px' },
  sub: { fontSize: 15, color: '#64748b', maxWidth: 480, margin: '0 auto' },
  stack: { display: 'flex', flexDirection: 'column', gap: 20 },
  actionBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  actionRight: { display: 'flex', alignItems: 'center', gap: 8 },
};

export default function StudentPage() {
  const [step, setStep]           = useState('form');
  const [studentName, setName]    = useState('');
  const [usn, setUsn]             = useState('');
  const [branch, setBranch]       = useState('cs-ds');
  const [semester, setSemester]   = useState(4);
  const [subjects, setSubjects]   = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [marks, setMarks]         = useState({});
  const [splitMode, setSplitMode] = useState(false);
  const [errors, setErrors]       = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [result, setResult]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [history, setHistory]     = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const resultRef = useRef(null);

  // Fetch subjects dynamically from Firestore when branch/semester changes
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingSubjects(true);
      try {
        const list = await fetchCurriculum(branch, semester);
        if (active) {
          setSubjects(list);
          const initial = {};
          list.forEach(s => {
            initial[s.key] = '';
            initial[`${s.key}_int`] = '';
            initial[`${s.key}_ext`] = '';
          });
          setMarks(initial);
          setErrors({});
          setFieldErrors({});
        }
      } catch (err) {
        toast.error('Failed to load curriculum subjects');
      } finally {
        if (active) setLoadingSubjects(false);
      }
    }
    load();
    return () => { active = false; };
  }, [branch, semester]);

  // Track visit on mount (resilient to database creation delay)
  useEffect(() => {
    const { sessionId, needsRecord } = getOrCreateSession();
    if (needsRecord) {
      recordVisit(sessionId, getDeviceInfo()).then((success) => {
        if (success) markSessionAsRecorded();
      });
    }
  }, []);

  const handleMarkChange = useCallback((key, value) => {
    setMarks(p => ({ ...p, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(p => { const n = { ...p }; delete n[key]; return n; });
  }, [fieldErrors]);

  const handleUSN = (v) => {
    setUsn(v.toUpperCase());
    if (errors.usn) setErrors(p => { const n = { ...p }; delete n.usn; return n; });
  };

  const fetchHistory = async (usnVal) => {
    if (!usnVal || usnVal.length < 4) return;
    try {
      const records = await getResultsByUSN(usnVal);
      setHistory(records);
      setShowHistory(records.length > 0);
    } catch { /* silent */ }
  };

  const validate = () => {
    const errs = {};
    if (!studentName.trim()) errs.name = 'Name is required';
    if (!usn.trim()) errs.usn = 'USN is required';
    else if (usn.trim().length < 5) errs.usn = 'USN is too short';
    const { valid, errors: mErrs } = validateMarks(marks, subjects);
    if (!valid) { setFieldErrors(mErrs); errs.marks = 'Fix marks'; }
    setErrors(errs);
    return Object.keys(errs).length === 0 && valid;
  };

  const handleCalculate = async () => {
    if (!validate()) { toast.error('Please fix the errors above'); return; }

    const { allowed, remainingMs } = checkRateLimit(usn);
    if (!allowed) { toast.error(`Wait ${formatCooldown(remainingMs)} before resubmitting`); return; }

    const calculated = calculateSGPA(marks, subjects);
    setResult(calculated);
    setStep('result');
    setSaved(false);

    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

    setSaving(true);
    try {
      const subjectsPayload = {};
      calculated.breakdown.forEach(s => {
        subjectsPayload[s.key] = { label: s.label, marks: s.marks, gradePoint: s.gradePoint, grade: s.grade, credits: s.credits, code: s.code };
      });
      await saveResult({ 
        name: studentName.trim(), 
        usn: usn.trim(), 
        branch,
        semester: Number(semester),
        sgpa: calculated.sgpa, 
        subjects: subjectsPayload 
      });
      recordSubmission(usn);
      setSaved(true);
      toast.success('Result saved!');
    } catch (err) {
      console.error('[Save]', err);
      toast.error('Calculated OK, but save failed: ' + (err.code ?? err.message));
    } finally { setSaving(false); }
  };

  const handleDownloadPDF = () => {
    toast('Opening print preview. Select "Save as PDF" to download.', {
      icon: 'ℹ️',
      duration: 5000,
    });
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleShare = async () => {
    const text = `${studentName} (${usn}) — SGPA: ${result?.sgpa?.toFixed(2)} | BIET SGPA Calculator`;
    if (navigator.share) {
      await navigator.share({ title: 'My BIET SGPA Result', text, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    }
  };

  const handleReset = () => {
    setStep('form'); setResult(null);
    const initial = {};
    subjects.forEach(s => {
      initial[s.key] = '';
      initial[`${s.key}_int`] = '';
      initial[`${s.key}_ext`] = '';
    });
    setMarks(initial);
    setErrors({}); setFieldErrors({}); setSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main style={S.page}>

      {/* Hero */}
      <motion.div className="no-print" style={S.hero} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={S.chip}>
          <Calculator size={13} /> VTU Grading System · 2024–25
        </div>
        <h1 style={S.h1}>
          SGPA{' '}
          <span style={{ background: 'linear-gradient(135deg,#3b82f6,#14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Calculator
          </span>
        </h1>
        <p style={S.sub}>
          Enter your subject marks to instantly calculate your Semester Grade Point Average based on VTU norms.
        </p>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ── FORM STEP ── */}
        {step === 'form' && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={S.stack}>

            {/* Student Info */}
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
                Student Information
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label className="form-label" htmlFor="student-name">Full Name</label>
                  <input
                    id="student-name"
                    className={`input-field ${errors.name ? 'error' : ''}`}
                    placeholder="e.g. Rahul Sharma"
                    value={studentName}
                    onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => { const n = {...p}; delete n.name; return n; }); }}
                  />
                  {errors.name && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.name}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="student-usn">USN</label>
                  <input
                    id="student-usn"
                    className={`input-field ${errors.usn ? 'error' : ''}`}
                    style={{ fontFamily: 'monospace' }}
                    placeholder="e.g. 4BD21CS001"
                    value={usn}
                    onChange={e => handleUSN(e.target.value)}
                    onBlur={() => fetchHistory(usn)}
                  />
                  {errors.usn && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.usn}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="student-branch">Branch</label>
                  <select
                    id="student-branch"
                    className="input-field"
                    value={branch}
                    onChange={e => setBranch(e.target.value)}
                    style={{ cursor: 'pointer', appearance: 'auto' }}
                  >
                    {BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="student-semester">Semester</label>
                  <select
                    id="student-semester"
                    className="input-field"
                    value={semester}
                    onChange={e => setSemester(Number(e.target.value))}
                    style={{ cursor: 'pointer', appearance: 'auto' }}
                  >
                    {SEMESTERS.map(s => (
                      <option key={s} value={s}>{s}th Semester</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Past history */}
            <AnimatePresence>
              {showHistory && history.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="card" style={{ padding: 18, borderColor: '#bfdbfe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <History size={15} color="#3b82f6" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>Past Results for {usn}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {history.map(h => (
                      <div key={h.id} style={{
                        flexShrink: 0, minWidth: 80, padding: '10px 14px', borderRadius: 10, textAlign: 'center',
                        background: '#eff6ff', border: '1px solid #bfdbfe',
                      }}>
                        <p style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8', margin: 0 }}>{h.sgpa?.toFixed(2)}</p>
                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
                          {h.timestamp?.toDate
                            ? h.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                            : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subjects */}
            {loadingSubjects ? (
              <div className="card" style={{ padding: 36, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Loading curriculum subjects...</p>
                </div>
              </div>
            ) : (
              <SubjectForm
                subjects={subjects}
                marks={marks} onChange={handleMarkChange} errors={fieldErrors}
                splitMode={splitMode} onToggleSplit={() => setSplitMode(v => !v)}
              />
            )}

            {/* Submit */}
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <button id="calculate-btn" className="btn-primary" onClick={handleCalculate}
                style={{ fontSize: 16, padding: '13px 36px' }}>
                <Calculator size={18} />
                Calculate SGPA
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── RESULT STEP ── */}
        {step === 'result' && result && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            ref={resultRef} style={S.stack}>

            {/* Action bar */}
            <div style={S.actionBar} className="no-print">
              <button className="btn-secondary" onClick={handleReset}>
                <RotateCcw size={15} /> Calculate Again
              </button>
              <div style={S.actionRight}>
                {saving && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}>
                    <Clock size={13} /> Saving…
                  </span>
                )}
                {!saving && saved && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#22c55e' }}>
                    <CheckCircle2 size={13} /> Saved
                  </span>
                )}
                <button id="pdf-btn" className="btn-secondary" onClick={handleDownloadPDF}><Download size={14} /> PDF</button>
                <button id="print-btn" className="btn-secondary" onClick={() => window.print()}><Printer size={14} /> Print</button>
                <button id="share-btn" className="btn-secondary" onClick={handleShare}><Share2 size={14} /> Share</button>
              </div>
            </div>

            {/* Print header */}
            {/* Printable Container */}
            <div id="pdf-content">
              {/* ── Screen-Only Layout (Modern Cards & Badges) ── */}
              <div className="no-print">
                <ResultCard result={result} studentName={studentName} usn={usn} />
                <div style={{ marginTop: 20 }}>
                  <SubjectTable breakdown={result.breakdown} />
                </div>
              </div>

              {/* ── Print-Only Layout (Exact replica of BIET Provisional Marks Card) ── */}
              <div className="print-only-layout">
                {/* Header section matching the 3rd image */}
                <div className="print-header-container">
                  <div className="print-logo">
                    <svg width="72" height="72" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="#000000" strokeWidth="2.5" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#000000" strokeWidth="1" strokeDasharray="3 2" />
                      {/* Book representation */}
                      <path d="M30 65 L50 72 L70 65 L70 45 L50 52 L30 45 Z" fill="#000000" opacity="0.1" />
                      <path d="M30 45 L50 52 L70 45" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M30 55 L50 62 L70 55" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M30 65 L50 72 L70 65" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="50" y1="36" x2="50" y2="72" stroke="#000000" strokeWidth="2" />
                      {/* Flame representation */}
                      <path d="M50 30 C47 24, 53 18, 50 12 C47 18, 53 24, 50 30 Z" fill="#000000" />
                      <text x="50" y="87" fontSize="11" fontWeight="bold" fontFamily="Times New Roman" textAnchor="middle" fill="#000000">BIET</text>
                    </svg>
                  </div>
                  <div className="print-header-text">
                    <h1>Bapuji Institute of Engineering and Technology, Davanagere</h1>
                    <p className="print-subheader">( An Autonomous Institute Affiliated to Visvesvaraya Technological University, Belagavi )</p>
                    <p className="print-title">Provisional Results of B.E. / B.Tech. Autonomous Examination June/July 2026</p>
                  </div>
                </div>

                {/* Boxed Student Info Block */}
                <table className="print-student-info-table">
                  <tbody>
                    <tr>
                      <td className="info-label">University Seat Number</td>
                      <td className="info-value">{usn.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td className="info-label">Student Name</td>
                      <td className="info-value">{studentName.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td className="info-label">Branch</td>
                      <td className="info-value">{(BRANCHES.find(b => b.id === branch)?.name || branch).toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td className="info-label">Semester</td>
                      <td className="info-value">{semester}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Authentic Course Grades Table */}
                <table className="print-marks-table">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Course Code</th>
                      <th style={{ width: '45%' }}>Course Title</th>
                      <th style={{ width: '10%' }}>CIE</th>
                      <th style={{ width: '10%' }}>SEE</th>
                      <th style={{ width: '10%' }}>Total</th>
                      <th style={{ width: '10%' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakdown.map((row) => {
                      const intMarks = marks[`${row.key}_int`] !== undefined && marks[`${row.key}_int`] !== '' ? marks[`${row.key}_int`] : '—';
                      const extMarks = marks[`${row.key}_ext`] !== undefined && marks[`${row.key}_ext`] !== '' ? marks[`${row.key}_ext`] : '—';

                      return (
                        <tr key={row.key}>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.code}</td>
                          <td className="subject-title-cell">{row.label}</td>
                          <td style={{ textAlign: 'center' }}>{row.excluded ? '—' : intMarks}</td>
                          <td style={{ textAlign: 'center' }}>{row.excluded ? '—' : extMarks}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.marks}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.grade}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* SGPA display */}
                <div className="print-sgpa-box">
                  SEMESTER GRADE POINT AVERAGE (SGPA):
                  <span className="print-sgpa-value">{result.sgpa.toFixed(2)}</span>
                </div>

                {/* Nomenclature Table */}
                <div className="print-nomenclature-section">
                  <p className="nomenclature-title">Nomenclature</p>
                  <table className="print-nomenclature-table">
                    <tbody>
                      <tr>
                        <td className="nom-header">Marks Range</td>
                        <td>90 - 100</td>
                        <td>80 - 89</td>
                        <td>70 - 79</td>
                        <td>60 - 69</td>
                        <td>50 - 59</td>
                        <td>0 - 49</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                      </tr>
                      <tr>
                        <td className="nom-header">Grade</td>
                        <td>O</td>
                        <td>A+</td>
                        <td>A</td>
                        <td>B+</td>
                        <td>B</td>
                        <td>F</td>
                        <td>AB</td>
                        <td>X</td>
                        <td>DX</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="print-notes">
                    <p>I, W, X &rarr; Transitional grades as per the Autonomous Regulations of the Institute.</p>
                    <p>DX &emsp;&emsp; &rarr; Not fulfilling minimum requirement in CIE and/or Attendance.</p>
                    <p>AB &emsp;&emsp; &rarr; Absent in SEE.</p>
                    <p>WH &emsp;&emsp; &rarr; Withheld.</p>
                  </div>
                </div>

                {/* Signatures */}
                <div className="print-signatures-section">
                  <div className="signature-block">
                    <p className="signature-line">Controller of Examinations</p>
                  </div>
                  <div className="signature-block">
                    <p className="signature-line">Principal</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
