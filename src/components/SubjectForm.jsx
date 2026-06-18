import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const GRADE_TABLE = [
  { range: '90–100', gp: 10, grade: 'O',  color: '#065f46', bg: '#ecfdf5' },
  { range: '80–89',  gp: 9,  grade: 'A+', color: '#166534', bg: '#f0fdf4' },
  { range: '70–79',  gp: 8,  grade: 'A',  color: '#1e40af', bg: '#eff6ff' },
  { range: '60–69',  gp: 7,  grade: 'B+', color: '#1e40af', bg: '#eff6ff' },
  { range: '50–59',  gp: 6,  grade: 'B',  color: '#713f12', bg: '#fef9c3' },
  { range: '< 50',   gp: 0,  grade: 'F',  color: '#991b1b', bg: '#fef2f2' },
];

export default function SubjectForm({ subjects, marks, onChange, errors, splitMode, onToggleSplit }) {
  const [showGradeTable, setShowGradeTable] = useState(false);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Subject Marks</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>Enter marks out of 100 per subject</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Split toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Int + Ext</span>
            <div onClick={onToggleSplit} style={{
              width: 38, height: 22, borderRadius: 999, cursor: 'pointer',
              background: splitMode ? '#3b82f6' : '#cbd5e1',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: 3, width: 16, height: 16, background: 'white',
                borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s',
                transform: splitMode ? 'translateX(18px)' : 'translateX(3px)',
              }} />
            </div>
          </label>
          {/* Grade ref */}
          <button type="button" onClick={() => setShowGradeTable(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, color: '#3b82f6',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
              borderRadius: 6, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <Info size={13} />
            Grade Scale
            {showGradeTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Grade reference */}
      {showGradeTable && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
          {GRADE_TABLE.map(g => (
            <div key={g.gp} style={{
              padding: '10px 8px', textAlign: 'center',
              background: g.bg, borderRight: '1px solid #f1f5f9',
            }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: g.color, margin: 0 }}>{g.grade}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: g.color, margin: '1px 0' }}>{g.gp} pts</p>
              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{g.range}</p>
            </div>
          ))}
        </div>
      )}

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: splitMode ? '1fr 90px 90px 80px' : '1fr 120px',
        gap: 0,
        padding: '8px 24px',
        background: '#fafafa',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</span>
        {splitMode ? (
          <>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Internal</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>External</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
          </>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Marks / 100</span>
        )}
      </div>

      {/* Subject rows */}
      <div>
        {(subjects || []).map((subject, idx) => (
          <SubjectRow
            key={subject.key}
            subject={subject}
            marks={marks}
            onChange={onChange}
            errors={errors}
            splitMode={splitMode}
            isLast={idx === (subjects || []).length - 1}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{ padding: '10px 24px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Info size={11} />
          Physical Education (0 credits) is a non-credit course and excluded from SGPA calculation
        </p>
      </div>
    </div>
  );
}

function SubjectRow({ subject, marks, onChange, errors, splitMode, isLast }) {
  const isIgnored = subject.credits === 0;
  const hasError = errors?.[subject.key];

  const handleTotal = v => onChange(subject.key, v);

  const handleInternal = v => {
    const ext = Number(marks[`${subject.key}_ext`] ?? 0);
    const total = Math.min(Number(v) + ext, 100);
    onChange(subject.key, String(total));
    onChange(`${subject.key}_int`, v);
  };

  const handleExternal = v => {
    const int_ = Number(marks[`${subject.key}_int`] ?? 0);
    const total = Math.min(int_ + Number(v), 100);
    onChange(subject.key, String(total));
    onChange(`${subject.key}_ext`, v);
  };

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: splitMode ? '1fr 90px 90px 80px' : '1fr 120px',
    gap: 0,
    alignItems: 'center',
    padding: '11px 24px',
    borderBottom: isLast ? 'none' : '1px solid #f8fafc',
    background: hasError ? '#fef2f2' : isIgnored ? '#fafafa' : 'white',
    opacity: isIgnored ? 0.95 : 1,
    transition: 'background 0.15s',
  };

  return (
    <div style={rowStyle}>
      {/* Subject label */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
              {subject.code}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
              ({subject.alias})
            </span>
            {!isIgnored && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                {subject.credits} cr
              </span>
            )}
            {subject.hasLab && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                Lab
              </span>
            )}
            {isIgnored && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#fafafa', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                Non-Credit
              </span>
            )}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            {subject.label}
          </span>
        </div>
        {hasError && (
          <p style={{ fontSize: 11, color: '#dc2626', margin: '3px 0 0' }}>{hasError}</p>
        )}
      </div>

      {/* Inputs */}
      {splitMode && !isIgnored ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <input
              type="number" min="0" max="50" placeholder="0–50"
              value={marks[`${subject.key}_int`] ?? ''}
              onChange={e => handleInternal(e.target.value)}
              className="input-field"
              id={`int-${subject.key}`}
              style={{ width: 72, textAlign: 'center', padding: '7px 8px', fontSize: 14 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <input
              type="number" min="0" max="50" placeholder="0–50"
              value={marks[`${subject.key}_ext`] ?? ''}
              onChange={e => handleExternal(e.target.value)}
              className="input-field"
              id={`ext-${subject.key}`}
              style={{ width: 72, textAlign: 'center', padding: '7px 8px', fontSize: 14 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 60, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
              fontSize: 14, fontWeight: 700, color: '#1d4ed8',
            }}>
              {marks[subject.key] || 0}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <input
            type="number" min="0" max="100"
            placeholder="0–100"
            value={marks[subject.key] ?? ''}
            onChange={e => handleTotal(e.target.value)}
            className={`input-field ${hasError ? 'error' : ''}`}
            id={`marks-${subject.key}`}
            style={{ width: 80, textAlign: 'center', padding: '7px 8px', fontSize: 14 }}
          />
        </div>
      )}
    </div>
  );
}
