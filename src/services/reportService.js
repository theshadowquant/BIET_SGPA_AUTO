const PERFORMANCE_BANDS = [
  { min: 9, label: 'Excellent', tone: 'excellent' },
  { min: 8, label: 'Very Good', tone: 'very-good' },
  { min: 7, label: 'Good', tone: 'good' },
  { min: 6, label: 'Average', tone: 'average' },
  { min: -Infinity, label: 'Needs Improvement', tone: 'needs-improvement' },
];

export function getPerformance(sgpa) {
  return PERFORMANCE_BANDS.find(band => Number(sgpa) >= band.min) ?? PERFORMANCE_BANDS.at(-1);
}

export function getTotalCredits(subjects = []) {
  return subjects.reduce((total, subject) => total + Number(subject.credits || 0), 0);
}

export function formatReportDate(value = new Date()) {
  const date = value?.toDate?.() ?? value;
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function normaliseReport(result, branchName) {
  const subjects = Object.values(result?.subjects ?? {}).map((subject, index) => ({
    key: subject.key ?? subject.code ?? String(index),
    code: subject.code ?? '—',
    label: subject.label ?? subject.alias ?? 'Subject',
    credits: Number(subject.credits ?? 0),
    marks: subject.marks ?? '—',
    grade: subject.grade ?? '—',
    gradePoint: subject.gradePoint ?? '—',
  }));

  return {
    ...result,
    subjects,
    branchName: branchName ?? result?.branch ?? '—',
    totalCredits: getTotalCredits(subjects),
    performance: getPerformance(result?.sgpa),
  };
}
