import { formatReportDate, normaliseReport } from '../services/reportService';

export default function ReportCardPrint({ result, branchName, generatedAt }) {
  const report = normaliseReport(result, branchName);
  const generated = generatedAt ?? new Date();

  return (
    <article className="report-card-print" aria-label={`Report card for ${report.name}`}>
      <header className="report-card-header">
        <img src="/biet-logo.png" alt="BIET logo" className="report-logo" />
        <div>
          <p className="report-institute">Bapuji Institute of Engineering &amp; Technology</p>
          <h2>BIET SGPA Calculator</h2>
          <p className="report-caption">Academic Performance Report Card</p>
        </div>
        <div className="report-reference">Official<br />Student Report</div>
      </header>

      <section className="report-student-details">
        <div><span>Name</span><strong>{report.name || '—'}</strong></div>
        <div><span>USN</span><strong className="report-usn">{report.usn || '—'}</strong></div>
        <div><span>Branch</span><strong>{report.branchName}</strong></div>
        <div><span>Semester</span><strong>Semester {report.semester || '—'}</strong></div>
        <div className="report-date"><span>Date Generated</span><strong>{formatReportDate(generated)}</strong></div>
      </section>

      <section className="report-subject-section">
        <div className="report-section-heading"><span>Subject-wise Performance</span><small>Marks and grade points are generated from the submitted result.</small></div>
        <div className="report-table-wrap">
          <table className="report-subject-table">
            <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Credits</th><th>Marks</th><th>Grade</th><th>Grade Point</th></tr></thead>
            <tbody>
              {report.subjects.map(subject => (
                <tr key={subject.key}>
                  <td className="report-code">{subject.code}</td><td>{subject.label}</td><td>{subject.credits}</td><td>{subject.marks}</td>
                  <td><span className={`report-grade report-grade-${String(subject.grade).replace('+', 'plus').toLowerCase()}`}>{subject.grade}</span></td><td>{subject.gradePoint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-summary">
        <div><span>Total Credits</span><strong>{report.totalCredits}</strong></div>
        <div><span>SGPA</span><strong>{Number(report.sgpa ?? 0).toFixed(2)}<small> / 10</small></strong></div>
        <div><span>Performance</span><strong className={`report-performance ${report.performance.tone}`}>{report.performance.label}</strong></div>
      </section>

      <footer className="report-footer">
        <div className="report-signature"><span>Student Signature</span></div>
        <div className="report-generated">Generated using <strong>BIET SGPA Calculator</strong><br />{formatReportDate(generated)}</div>
        <div className="report-signature"><span>Administrator</span></div>
      </footer>
    </article>
  );
}
