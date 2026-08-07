import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Calculator, Download, Printer, Share2, History,
  ChevronRight, RotateCcw, Clock, CheckCircle2,
  Search, TrendingUp, Award, BookOpen, ChevronDown, ChevronUp,
  ShieldCheck,
} from 'lucide-react';

import SubjectForm from '../components/SubjectForm';
import ResultCard from '../components/ResultCard';
import SubjectTable from '../components/SubjectTable';
import DuplicateConfirmModal from '../components/DuplicateConfirmModal';

import { calculateSGPA, validateMarks } from '../utils/calculateSGPA';
import { validateFullName, validateUSN } from '../utils/validation';
import { checkRateLimit, recordSubmission, formatCooldown } from '../utils/rateLimit';
import { getOrCreateSession, getDeviceInfo, markSessionAsRecorded } from '../utils/sessionManager';
import {
  saveResult, getResultsByUSN, getStudentCGPA, recordVisit, fetchCurriculum,
  checkStudentIdentity, checkDuplicateResult, updateResult,
} from '../firebase/services';
import { useExamSession } from '../hooks/useExamSession';

const BRANCHES = [
  // Computer Science & IT
  { id: 'cs-ds',  name: 'CS&E (Data Science)',              dept: 'CS & IT' },
  { id: 'cse',    name: 'Computer Science & Engineering',    dept: 'CS & IT' },
  { id: 'aiml',   name: 'AI & Machine Learning',             dept: 'CS & IT' },
  { id: 'ise',    name: 'Information Science & Engineering', dept: 'CS & IT' },
  { id: 'csd',    name: 'Computer Science & Design',         dept: 'CS & IT' },
  { id: 'csbs',   name: 'CS & Business Systems',            dept: 'CS & IT' },
  // Electronics
  { id: 'ece',    name: 'Electronics & Communication Engg',  dept: 'Electronics' },
  { id: 'eie',    name: 'Electronics & Instrumentation',     dept: 'Electronics' },
  { id: 'vlsi',   name: 'Electronics (VLSI Design & Tech)', dept: 'Electronics' },
  // Electrical
  { id: 'eee',    name: 'Electrical & Electronics Engg',     dept: 'Electrical' },
  // Mechanical
  { id: 'me',     name: 'Mechanical Engineering',            dept: 'Mechanical' },
  { id: 'auto',   name: 'Automobile Engineering',            dept: 'Mechanical' },
  { id: 'ipe',    name: 'Industrial & Production Engg',      dept: 'Mechanical' },
  // Civil
  { id: 'cv',     name: 'Civil Engineering',                 dept: 'Civil' },
  { id: 'et',     name: 'Environmental Engineering',         dept: 'Civil' },
  // Textile
  { id: 'tx',     name: 'Textile Technology',                dept: 'Textile' },
  { id: 'txd',    name: 'Textile Design',                    dept: 'Textile' },
  // Science
  { id: 'bt',     name: 'Biotechnology',                     dept: 'Science' },
  { id: 'ch',     name: 'Chemical Engineering',              dept: 'Science' },
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

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

/** Ordinal suffix: 1st, 2nd, 3rd, 4th… */
function ordinal(n) {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

/** Derive a human-readable "Year X, Semester Y" label from the raw semester number */
function yearSemLabel(semNumber) {
  const year = Math.ceil(semNumber / 2);
  const semInYear = semNumber % 2 === 0 ? 2 : 1;
  return `Year ${year}, ${ordinal(semInYear)} Semester`;
}

/** Grade-point → color mapping */
function sgpaColor(sgpa) {
  if (sgpa >= 9)  return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
  if (sgpa >= 8)  return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
  if (sgpa >= 7)  return { bg: '#fef9c3', color: '#713f12', border: '#fde68a' };
  if (sgpa >= 6)  return { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' };
  return           { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' };
}

export default function StudentPage() {
  const [step, setStep]           = useState('form');
  const [studentName, setName]    = useState('');
  const [usn, setUsn]             = useState('');
  const [branch, setBranch]       = useState('');
  const [semester, setSemester]   = useState('');
  const [subjects, setSubjects]   = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [marks, setMarks]         = useState({});
  const [errors, setErrors]       = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [result, setResult]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [history, setHistory]     = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [calcMode, setCalcMode]   = useState('sgpa'); // 'sgpa' | 'cgpa'
  const [cgpa, setCgpa]               = useState(null);
  const [loadingCGPA, setLoadingCGPA] = useState(false);
  const resultRef = useRef(null);

  // Duplicate detection state
  const [showDupModal, setShowDupModal]   = useState(false);
  const [dupRecord, setDupRecord]         = useState(null);
  const [pendingSave, setPendingSave]     = useState(null); // payload to save if user confirms update

  // Exam session (from Firestore settings)
  const examSession = useExamSession();

  // Fetch subjects dynamically from Firestore when branch/semester changes
  useEffect(() => {
    let active = true;
    async function load() {
      if (!branch || !semester) {
        setSubjects([]);
        setLoadingSubjects(false);
        return;
      }
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
    setUsn(v.toUpperCase().replace(/\s/g, ''));
    if (errors.usn) setErrors(p => { const n = { ...p }; delete n.usn; return n; });
  };

  const fetchHistory = async (usnVal) => {
    if (!USN_PATTERN.test(usnVal.trim())) return;
    try {
      const records = await getResultsByUSN(usnVal);
      setHistory(records);
      setShowHistory(records.length > 0);
    } catch { /* silent */ }
  };

  const loadCGPA = async (usnValue, currentSemester) => {
    setLoadingCGPA(true);
    try {
      setCgpa(await getStudentCGPA(usnValue, currentSemester));
    } catch {
      setCgpa(null);
    } finally {
      setLoadingCGPA(false);
    }
  };

  const validate = () => {
    const errs = {};

    // Name: use the shared validation utility
    const nameCheck = validateFullName(studentName);
    if (!nameCheck.valid) errs.name = nameCheck.error;

    // USN: use the shared validation utility
    const usnCheck = validateUSN(usn);
    if (!usnCheck.valid) errs.usn = usnCheck.error;

    if (!branch) errs.branch = 'Branch is required';
    if (!semester) errs.semester = 'Semester is required';

    if (!branch || !semester) {
      setErrors(errs);
      return false;
    }

    const { valid, errors: mErrs } = validateMarks(marks, subjects, { useComponentPassing: true });
    if (!valid) { setFieldErrors(mErrs); errs.marks = 'Fix marks'; }
    setErrors(errs);
    return Object.keys(errs).length === 0 && valid;
  };

  const handleCalculate = async () => {
    if (!validate()) { toast.error('Please fix the errors above'); return; }

    const { allowed, remainingMs } = checkRateLimit(usn);
    if (!allowed) { toast.error(`Wait ${formatCooldown(remainingMs)} before resubmitting`); return; }

    const calculated = calculateSGPA(marks, subjects, { useComponentPassing: true });
    setResult(calculated);
    setStep('result');
    setSaved(false);

    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

    // Build subjects payload once (reused for both save and update)
    const subjectsPayload = {};
    calculated.breakdown.forEach(s => {
      const subjectResult = { label: s.label, marks: s.marks, gradePoint: s.gradePoint, grade: s.grade, credits: s.credits, code: s.code };
      if (s.cieMarks !== undefined && s.seeMarks !== undefined) {
        subjectResult.cieMarks = s.cieMarks;
        subjectResult.seeMarks = s.seeMarks;
        subjectResult.componentFailed = s.componentFailed;
      }
      subjectsPayload[s.key] = subjectResult;
    });

    setSaving(true);
    try {
      // 1. Check student identity (USN ↔ Name lock)
      const identity = await checkStudentIdentity(usn.trim(), studentName.trim());
      if (identity.conflict) {
        setSaving(false);
        setStep('form');
        setErrors(prev => ({
          ...prev,
          usn: `This USN is already registered to “${identity.registeredName}”. Check your USN or contact admin.`,
        }));
        toast.error('Identity conflict — USN belongs to another student.');
        return;
      }

      // 2. Check for duplicate USN + semester
      const dup = await checkDuplicateResult(usn.trim(), Number(semester));
      if (dup.exists) {
        setSaving(false);
        setDupRecord(dup.existingRecord);
        setPendingSave({ calculated, subjectsPayload, oldSgpa: dup.existingRecord.sgpa });
        setShowDupModal(true);
        return;
      }

      // 3. No duplicate — save new record
      await performSave(subjectsPayload);
    } catch (err) {
      console.error('[Calculate]', err);
      toast.error('Error during save: ' + (err.code ?? err.message));
    } finally {
      setSaving(false);
    }
  };

  /** Saves a brand-new result record */
  const performSave = async (subjectsPayload) => {
    await saveResult({
      name: studentName.trim(),
      usn: usn.trim(),
      branch,
      semester: Number(semester),
      sgpa: result?.sgpa ?? 0,
      subjects: subjectsPayload,
    });
    recordSubmission(usn);
    setSaved(true);
    toast.success('Result saved!');
    loadCGPA(usn, semester);
  };

  /** Called when user confirms updating an existing record */
  const handleConfirmUpdate = async () => {
    if (!pendingSave || !dupRecord) return;
    setShowDupModal(false);
    setSaving(true);
    try {
      await updateResult(dupRecord.id, {
        name: studentName.trim(),
        sgpa: pendingSave.calculated.sgpa,
        subjects: pendingSave.subjectsPayload,
        oldSgpa: pendingSave.oldSgpa,
      });
      recordSubmission(usn);
      setSaved(true);
      toast.success('Record updated successfully!');
      loadCGPA(usn, semester);
    } catch (err) {
      console.error('[Update]', err);
      toast.error('Update failed: ' + (err.code ?? err.message));
    } finally {
      setSaving(false);
      setDupRecord(null);
      setPendingSave(null);
    }
  };

  const handleCancelUpdate = () => {
    setShowDupModal(false);
    setDupRecord(null);
    setPendingSave(null);
    setSaved(false);
    toast('Keeping your previous record.', { icon: 'ℹ️' });
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
    setCgpa(null); setLoadingCGPA(false);
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
          SGPA & CGPA{' '}
          <span style={{ background: 'linear-gradient(135deg,#3b82f6,#14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Calculator
          </span>
        </h1>
        <p style={S.sub}>
          Calculate your Semester GPA instantly, or look up your Cumulative GPA across all completed semesters.
        </p>
      </motion.div>

      {/* ── Mode Switcher Tabs ── */}
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'center', gap: 10,
        marginBottom: 24, padding: 4, background: '#f1f5f9', borderRadius: 14,
        maxWidth: 460, margin: '0 auto 24px', border: '1px solid #e2e8f0'
      }}>
        <button
          id="mode-sgpa-btn"
          onClick={() => setCalcMode('sgpa')}
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: calcMode === 'sgpa' ? '#ffffff' : 'transparent',
            color: calcMode === 'sgpa' ? '#2563eb' : '#64748b',
            boxShadow: calcMode === 'sgpa' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Calculator size={16} /> SGPA Calculator
        </button>
        <button
          id="mode-cgpa-btn"
          onClick={() => setCalcMode('cgpa')}
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: calcMode === 'cgpa' ? '#ffffff' : 'transparent',
            color: calcMode === 'cgpa' ? '#2563eb' : '#64748b',
            boxShadow: calcMode === 'cgpa' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Award size={16} /> Auto CGPA Calculator
        </button>
      </div>

      {/* ── CGPA Calculator Panel (Prominent when in CGPA mode or collapsed in SGPA mode) ── */}
      {(calcMode === 'cgpa' || true) && (
        <motion.div className="no-print" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }} style={{ marginBottom: 24 }}>
          <CGPALookupPanel forceExpand={calcMode === 'cgpa'} />
        </motion.div>
      )}

      <AnimatePresence mode="wait">

        {/* ── FORM STEP ── */}
        {step === 'form' && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ ...S.stack, marginTop: 20 }}>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                SGPA Calculator
              </span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* Student Info */}
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
                Student Information
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label className="form-label" htmlFor="student-name">Full Name <span aria-hidden="true" style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    id="student-name"
                    className={`input-field ${errors.name ? 'error' : ''}`}
                    placeholder="e.g. Rahul Bisalahalli"
                    value={studentName}
                    required
                    onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => { const n = {...p}; delete n.name; return n; }); }}
                  />
                  {errors.name && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.name}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="student-usn">USN <span aria-hidden="true" style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    id="student-usn"
                    className={`input-field ${errors.usn ? 'error' : ''}`}
                    style={{ fontFamily: 'monospace' }}
                    placeholder="e.g. 4BD24CD001"
                    value={usn}
                    required
                    maxLength={10}
                    pattern="4BD[0-9]{2}[A-Za-z]{2}[0-9]{3}"
                    title="Use the format 4BD24CD001"
                    onChange={e => handleUSN(e.target.value)}
                    onBlur={() => fetchHistory(usn)}
                  />
                  {errors.usn && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.usn}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="student-branch">Branch</label>
                  <select
                    id="student-branch"
                    className={`input-field ${errors.branch ? 'error' : ''}`}
                    value={branch}
                    onChange={e => { setBranch(e.target.value); if (errors.branch) setErrors(p => { const n = {...p}; delete n.branch; return n; }); }}
                    style={{ cursor: 'pointer', appearance: 'auto' }}
                  >
                    <option value="">Select Branch</option>
                    {Object.entries(
                      BRANCHES.reduce((acc, b) => { if (!acc[b.dept]) acc[b.dept] = []; acc[b.dept].push(b); return acc; }, {})
                    ).map(([dept, branches]) => (
                      <optgroup key={dept} label={dept}>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {errors.branch && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.branch}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="student-semester">Semester</label>
                  <select
                    id="student-semester"
                    className={`input-field ${errors.semester ? 'error' : ''}`}
                    value={semester}
                    onChange={e => { const val = e.target.value ? Number(e.target.value) : ''; setSemester(val); if (errors.semester) setErrors(p => { const n = {...p}; delete n.semester; return n; }); }}
                    style={{ cursor: 'pointer', appearance: 'auto' }}
                  >
                    <option value="">Select Semester</option>
                    {SEMESTERS.map(s => (
                      <option key={s} value={s}>{ordinal(s)} Semester</option>
                    ))}
                  </select>
                  {errors.semester && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.semester}</p>}
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
            {!branch || !semester ? (
              <div className="card" style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'rgba(255, 255, 255, 0.7)', borderStyle: 'dashed' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#2563eb'
                }}>
                  <Calculator size={22} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>Select Branch & Semester</h3>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, maxWidth: 300 }}>Please choose your branch and semester above to load your curriculum subjects.</p>
              </div>
            ) : loadingSubjects ? (
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
                <CGPACard cgpa={cgpa} loading={loadingCGPA} currentSemester={Number(semester)} />
                <div style={{ marginTop: 20 }}>
                  <SubjectTable breakdown={result.breakdown} />
                </div>
              </div>

              {/* ── Print-Only Layout (Exact replica of BIET Provisional Marks Card) ── */}
              <div className="print-only-layout">
                {/* Header section matching the 3rd image */}
                <div className="print-header-container">
                  <div className="print-logo">
                    <img src="/biet-logo.png" alt="BIET Logo" style={{ width: 72, height: 72, objectFit: 'contain', display: 'block' }} />
                  </div>
                  <div className="print-header-text">
                    <h1>Bapuji Institute of Engineering and Technology, Davanagere</h1>
                    <p className="print-subheader">( An Autonomous Institute Affiliated to Visvesvaraya Technological University, Belagavi )</p>
                    <p className="print-title">Provisional Results of B.E. / B.Tech. {examSession.examTitle}, {examSession.examMonth} {examSession.examYear}</p>
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

      {/* Duplicate Result Confirmation Modal */}
      <DuplicateConfirmModal
        existing={dupRecord}
        onUpdate={handleConfirmUpdate}
        onCancel={handleCancelUpdate}
      />
    </main>
  );
}

// ─── CGPA Lookup Panel ────────────────────────────────────────────────────────
function CGPALookupPanel({ forceExpand = false }) {
  const [lookupUsn, setLookupUsn]     = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]   = useState('');
  const [expanded, setExpanded]         = useState(true);

  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  const handleLookup = async () => {
    const trimmed = lookupUsn.trim().toUpperCase();
    if (!trimmed) { setLookupError('Please enter your USN'); return; }
    if (!/^4BD\d{2}[A-Z]{2}\d{3}$/.test(trimmed)) {
      setLookupError('Enter a valid USN — e.g. 4BD24CD001');
      return;
    }
    setLookupError('');
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const data = await getStudentCGPA(trimmed);
      setLookupResult(data);
      setExpanded(true);
    } catch {
      setLookupError('Failed to fetch records. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const hasSemesters = lookupResult && lookupResult.semesterBreakdown?.length > 0;
  const hasCGPA = lookupResult && lookupResult.cgpa !== null;

  return (
    <div style={{
      borderRadius: 16,
      border: '1.5px solid #bfdbfe',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%)',
      overflow: 'hidden',
      marginBottom: 0,
      boxShadow: '0 2px 12px rgba(37,99,235,0.06)',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
        id="cgpa-lookup-toggle"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Award size={18} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#1e3a8a' }}>CGPA Lookup</p>
            <p style={{ margin: 0, fontSize: 11, color: '#3b82f6', fontWeight: 500 }}>
              Enter your USN to instantly view your semester history & CGPA
            </p>
          </div>
        </div>
        <div style={{ color: '#3b82f6', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Collapsible body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="cgpa-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 20px 20px' }}>
              {/* Search bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input
                  id="cgpa-usn-input"
                  className="input-field"
                  style={{ fontFamily: 'monospace', flex: 1, background: '#fff' }}
                  placeholder="Enter your USN — e.g. 4BD24CD001"
                  value={lookupUsn}
                  maxLength={10}
                  onChange={e => {
                    setLookupUsn(e.target.value.toUpperCase().replace(/\s/g, ''));
                    setLookupError('');
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                />
                <button
                  id="cgpa-lookup-btn"
                  className="btn-primary"
                  onClick={handleLookup}
                  disabled={lookupLoading}
                  style={{ padding: '10px 20px', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {lookupLoading ? (
                    <svg className="animate-spin" fill="none" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : <Search size={15} />}
                  {lookupLoading ? 'Looking up…' : 'Look Up'}
                </button>
              </div>

              {/* Error */}
              {lookupError && (
                <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12, fontWeight: 600 }}>{lookupError}</p>
              )}

              {/* Results */}
              {lookupResult && (
                <AnimatePresence>
                  <motion.div
                    key="cgpa-results"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* No records at all */}
                    {!hasSemesters && (
                      <div style={{
                        padding: '20px', borderRadius: 12, background: '#fff8f0',
                        border: '1px solid #fed7aa', textAlign: 'center',
                      }}>
                        <BookOpen size={28} style={{ color: '#f97316', margin: '0 auto 8px' }} />
                        <p style={{ fontWeight: 700, color: '#9a3412', margin: '0 0 4px', fontSize: 14 }}>
                          No Records Found
                        </p>
                        <p style={{ fontSize: 12, color: '#c2410c', margin: 0 }}>
                          No semester results found for <strong>{lookupUsn}</strong>. Calculate your SGPA below and save it to build your CGPA history.
                        </p>
                      </div>
                    )}

                    {/* Has semester data */}
                    {hasSemesters && (
                      <>
                        {/* CGPA hero or missing notice */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 16, flexWrap: 'wrap',
                          padding: '14px 18px', borderRadius: 12,
                          background: hasCGPA ? '#fff' : '#fffbeb',
                          border: `1px solid ${hasCGPA ? '#bfdbfe' : '#fde68a'}`,
                          marginBottom: 16,
                        }}>
                          <div>
                            <p style={{
                              margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
                              color: hasCGPA ? '#2563eb' : '#d97706', textTransform: 'uppercase',
                            }}>
                              {hasCGPA ? 'Cumulative GPA' : 'Incomplete CGPA'}
                            </p>
                            {hasCGPA ? (
                              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#334155', fontWeight: 600 }}>
                                Calculated from Sem 1 → Sem {lookupResult.latestSemester} &nbsp;·&nbsp;{' '}
                                <span style={{ color: '#2563eb' }}>
                                  {yearSemLabel(lookupResult.latestSemester)}
                                </span>
                              </p>
                            ) : (
                              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#92400e' }}>
                                Missing: Semester {lookupResult.missingSemesters.join(', ')} — submit those to complete your CGPA.
                              </p>
                            )}
                          </div>
                          {hasCGPA && (
                            <div style={{
                              minWidth: 110, padding: '10px 16px', borderRadius: 12, textAlign: 'center',
                              background: 'linear-gradient(135deg, #eff6ff, #e0f2fe)',
                              border: '1.5px solid #93c5fd',
                            }}>
                              <p style={{ margin: 0, fontSize: 30, lineHeight: 1, fontWeight: 900, color: '#1d4ed8' }}>
                                {lookupResult.cgpa.toFixed(2)}
                              </p>
                              <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: '#64748b' }}>
                                CGPA / 10
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Semester-by-semester timeline */}
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                          Semester Breakdown
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {lookupResult.semesterBreakdown.map(sem => {
                            const colors = sgpaColor(sem.sgpa);
                            return (
                              <motion.div
                                key={sem.semester}
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: sem.semester * 0.04 }}
                                style={{
                                  flex: '1 1 calc(25% - 8px)', minWidth: 80,
                                  padding: '12px 10px', borderRadius: 12, textAlign: 'center',
                                  background: colors.bg, border: `1.5px solid ${colors.border}`,
                                }}
                              >
                                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: colors.color, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                                  Sem {sem.semester}
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, color: colors.color, lineHeight: 1 }}>
                                  {sem.sgpa.toFixed(2)}
                                </p>
                                <p style={{ margin: '3px 0 0', fontSize: 9, color: colors.color, opacity: 0.75, fontWeight: 600 }}>
                                  {yearSemLabel(sem.semester)}
                                </p>
                              </motion.div>
                            );
                          })}

                          {/* Missing semester placeholders */}
                          {lookupResult.missingSemesters.map(sem => (
                            <div
                              key={`missing-${sem}`}
                              style={{
                                flex: '1 1 calc(25% - 8px)', minWidth: 80,
                                padding: '12px 10px', borderRadius: 12, textAlign: 'center',
                                background: '#f8fafc', border: '1.5px dashed #cbd5e1',
                              }}
                            >
                              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                                Sem {sem}
                              </p>
                              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#cbd5e1', lineHeight: 1 }}>—</p>
                              <p style={{ margin: '3px 0 0', fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>Not submitted</p>
                            </div>
                          ))}
                        </div>

                        {/* Progress bar */}
                        {hasCGPA && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(lookupResult.cgpa / 10) * 100}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                style={{
                                  height: '100%', borderRadius: 999,
                                  background: 'linear-gradient(90deg, #3b82f6, #6366f1, #14b8a6)',
                                }}
                              />
                            </div>
                            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, textAlign: 'right', fontWeight: 600 }}>
                              {((lookupResult.cgpa / 10) * 100).toFixed(1)}% of maximum GPA
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CGPA Card (shown after SGPA calculation) ─────────────────────────────────
function CGPACard({ cgpa, loading, currentSemester }) {
  if (!loading && !cgpa) return null;

  const hasCGPA = !loading && cgpa?.cgpa !== null;
  const year = cgpa ? Math.ceil(cgpa.latestSemester / 2) : null;
  const semInYear = cgpa ? (cgpa.latestSemester % 2 === 0 ? 2 : 1) : null;

  return (
    <div className="glass-card" style={{ marginTop: 20, padding: 20, borderColor: '#bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#2563eb', textTransform: 'uppercase' }}>
            <TrendingUp size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Automatic CGPA
          </p>
          {loading ? (
            <p style={{ margin: '5px 0 0', fontSize: 13, color: '#64748b' }}>Calculating from saved semester results…</p>
          ) : hasCGPA ? (
            <>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: '#475569', fontWeight: 600 }}>
                Semester 1 → Semester {cgpa.latestSemester} &nbsp;·&nbsp;
                <span style={{ color: '#2563eb' }}>Year {year}, {ordinal(semInYear)} Semester</span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                Average of {cgpa.latestSemester} semester{cgpa.latestSemester > 1 ? 's' : ''}: {cgpa.semesterBreakdown?.map(s => s.sgpa.toFixed(2)).join(' + ')} = <strong>{cgpa.cgpa.toFixed(2)} ÷ {cgpa.latestSemester}</strong>
              </p>
            </>
          ) : (
            <p style={{ margin: '5px 0 0', fontSize: 13, color: '#92400e', fontWeight: 600 }}>
              Add results for Semester {cgpa?.missingSemesters?.join(', ')} to complete the CGPA.
            </p>
          )}
        </div>
        {hasCGPA && (
          <div style={{ minWidth: 132, padding: '10px 16px', borderRadius: 12, textAlign: 'center', background: '#fff', border: '1px solid #bfdbfe' }}>
            <p style={{ margin: 0, fontSize: 28, lineHeight: 1, fontWeight: 900, color: '#1d4ed8' }}>{cgpa.cgpa.toFixed(2)}</p>
            <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: '#64748b' }}>CGPA / 10</p>
          </div>
        )}
      </div>

      {/* Mini semester timeline */}
      {hasCGPA && cgpa.semesterBreakdown?.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cgpa.semesterBreakdown.map(sem => {
            const colors = sgpaColor(sem.sgpa);
            return (
              <div key={sem.semester} style={{
                padding: '5px 12px', borderRadius: 8, background: colors.bg,
                border: `1px solid ${colors.border}`, textAlign: 'center', minWidth: 60,
              }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: colors.color, letterSpacing: '.06em' }}>SEM {sem.semester}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: colors.color }}>{sem.sgpa.toFixed(2)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
