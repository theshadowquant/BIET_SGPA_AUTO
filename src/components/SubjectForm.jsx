import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const GRADE_TABLE = [
  ['90–100', 10, 'O'], ['80–89', 9, 'A+'], ['70–79', 8, 'A'], ['60–69', 7, 'B+'],
  ['55–59', 6, 'B'], ['50–54', 5, 'C'], ['40–49', 4, 'P'], ['< 40', 0, 'F'],
];

export default function SubjectForm({ subjects, marks, onChange, errors }) {
  const [showGradeTable, setShowGradeTable] = useState(false);
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Subject Marks</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>Enter CIE and SEE marks. CIE minimum: 20/50 · SEE minimum: 18/50 · Passing total: 40/100</p>
        </div>
        <button type="button" onClick={() => setShowGradeTable(value => !value)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          <Info size={13} /> Grade Scale {showGradeTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      {showGradeTable && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
        {GRADE_TABLE.map(([range, gp, grade]) => <div key={grade} style={{ padding: '10px 5px', textAlign: 'center', background: grade === 'F' ? '#fef2f2' : '#f8fafc', borderRight: '1px solid #f1f5f9' }}><p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{grade}</p><p style={{ fontSize: 11, fontWeight: 700, margin: '1px 0' }}>{gp} pts</p><p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>{range}</p></div>)}
      </div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px', padding: '8px 24px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
        <span style={headerStyle}>Subject</span><span style={{ ...headerStyle, textAlign: 'center' }}>CIE / 50</span><span style={{ ...headerStyle, textAlign: 'center' }}>SEE / 50</span><span style={{ ...headerStyle, textAlign: 'center' }}>Total</span>
      </div>
      {(subjects || []).map((subject, index) => <SubjectRow key={subject.key} subject={subject} marks={marks} onChange={onChange} error={errors?.[subject.key]} isLast={index === subjects.length - 1} />)}
      <div style={{ padding: '10px 24px', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}><p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}><Info size={11} style={{ display: 'inline', marginRight: 5 }} />Physical Education is non-credit and excluded from SGPA calculation.</p></div>
    </div>
  );
}

const headerStyle = { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' };

function SubjectRow({ subject, marks, onChange, error, isLast }) {
  const nonCredit = Number(subject.credits) === 0;
  const updateCie = value => { const see = Number(marks[`${subject.key}_ext`] ?? 0); onChange(`${subject.key}_int`, value); onChange(subject.key, String(Math.min(Number(value) + see, 100))); };
  const updateSee = value => { const cie = Number(marks[`${subject.key}_int`] ?? 0); onChange(`${subject.key}_ext`, value); onChange(subject.key, String(Math.min(cie + Number(value), 100))); };
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px', alignItems: 'center', padding: '11px 24px', borderBottom: isLast ? 'none' : '1px solid #f8fafc', background: error ? '#fef2f2' : nonCredit ? '#fafafa' : 'white' }}>
    <div><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{subject.code}</span><span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>({subject.alias})</span>{!nonCredit && <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>{subject.credits} cr</span>}</div><p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '4px 0 0' }}>{subject.label}</p>{error && <p style={{ fontSize: 11, color: '#dc2626', margin: '3px 0 0' }}>{error}</p>}</div>
    {nonCredit ? <><span /><span /><div style={totalStyle}>{marks[subject.key] || 0}</div></> : <><Input value={marks[`${subject.key}_int`]} onChange={updateCie} id={`cie-${subject.key}`} /><Input value={marks[`${subject.key}_ext`]} onChange={updateSee} id={`see-${subject.key}`} /><div style={totalStyle}>{marks[subject.key] || 0}</div></>}
  </div>;
}

function Input({ value, onChange, id }) { return <div style={{ display: 'flex', justifyContent: 'center' }}><input id={id} type="number" min="0" max="50" placeholder="0–50" value={value ?? ''} onChange={event => onChange(event.target.value)} className="input-field" style={{ width: 72, textAlign: 'center', padding: '7px 8px', fontSize: 14 }} /></div>; }
const totalStyle = { width: 60, height: 36, justifySelf: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#1d4ed8' };
