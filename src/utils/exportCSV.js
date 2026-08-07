/**
 * CSV Export Utility — client-side, no backend required.
 *
 * Supports:
 *  - exportToCSV(data, filename)       — export a pre-loaded array (paginated view)
 *  - exportAllToCSV(fetchFn, filename) — stream all records via async fetch, then download
 */

const EXPORT_COLUMNS = [
  { key: 'name',       label: 'Student Name' },
  { key: 'usn',        label: 'USN' },
  { key: 'branchName', label: 'Branch' },
  { key: 'semester',   label: 'Semester' },
  { key: 'sgpa',       label: 'SGPA' },
  { key: 'cgpa',       label: 'CGPA' },
  { key: 'status',     label: 'Status' },
  { key: 'timestamp',  label: 'Submitted At' },
];

const BRANCH_MAP = {
  'cs-ds': 'CS&E (Data Science)',
  'cse':   'Computer Science & Engineering',
  'aiml':  'AI & Machine Learning',
  'ise':   'Information Science & Engineering',
  'csd':   'Computer Science & Design',
  'csbs':  'CS & Business Systems',
  'ece':   'Electronics & Communication Engg',
  'eie':   'Electronics & Instrumentation',
  'vlsi':  'Electronics (VLSI Design & Tech)',
  'eee':   'Electrical & Electronics Engg',
  'me':    'Mechanical Engineering',
  'auto':  'Automobile Engineering',
  'ipe':   'Industrial & Production Engg',
  'cv':    'Civil Engineering',
  'et':    'Environmental Engineering',
  'tx':    'Textile Technology',
  'txd':   'Textile Design',
  'bt':    'Biotechnology',
  'ch':    'Chemical Engineering',
};

/**
 * Converts an array of objects to a CSV string.
 * @param {Array<Object>} data
 * @param {Array<{key: string, label: string}>} columns
 * @returns {string}
 */
function toCSV(data, columns) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Normalizes a raw Firestore result document for CSV export.
 * @param {Object} row
 * @returns {Object}
 */
function normalizeRow(row) {
  const sgpa = typeof row.sgpa === 'number' ? row.sgpa.toFixed(2) : (row.sgpa ?? '');
  const cgpa = typeof row.cgpa === 'number' ? row.cgpa.toFixed(2) : (row.cgpa ?? '');
  const timestamp = row.timestamp?.toDate
    ? row.timestamp.toDate().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : (row.timestamp ? new Date(row.timestamp).toLocaleString('en-IN') : '');

  // Pass/Fail status
  const subjects = row.subjects ? Object.values(row.subjects) : [];
  const hasFail = subjects.some(s => s.gradePoint === 0 || s.grade === 'F');
  const status = hasFail ? 'Backlog' : 'Pass';

  return {
    name:       row.name ?? '',
    usn:        row.usn ?? '',
    branchName: BRANCH_MAP[row.branch] || row.branch || '',
    semester:   row.semester ?? '',
    sgpa,
    cgpa,
    status,
    timestamp,
  };
}

/**
 * Triggers a CSV file download from a pre-loaded data array.
 * Use this when you already have the records in memory (e.g. current page).
 *
 * @param {Array<Object>} data  — array of Firestore result documents
 * @param {string} filename
 */
export function exportToCSV(data, filename = 'biet_results.csv') {
  if (!data || data.length === 0) return;
  const formatted = data.map(normalizeRow);
  const csv = toCSV(formatted, EXPORT_COLUMNS);
  downloadCSV(csv, filename);
}

/**
 * Fetches ALL records via the provided async fetch function, then downloads CSV.
 * Use this for full-database or full-filtered-dataset export.
 *
 * @param {() => Promise<Array<Object>>} fetchFn   — async function returning all records
 * @param {string} filename
 * @param {(progress: number) => void} [onProgress] — optional progress callback (0-100)
 * @returns {Promise<number>} — total record count exported
 */
export async function exportAllToCSV(fetchFn, filename = 'biet_all_results.csv', onProgress) {
  const allRecords = await fetchFn(progress => {
    if (onProgress) onProgress(progress);
  });
  if (!allRecords || allRecords.length === 0) return 0;
  const formatted = allRecords.map(normalizeRow);
  const csv = toCSV(formatted, EXPORT_COLUMNS);
  downloadCSV(csv, filename);
  return allRecords.length;
}

/**
 * Triggers a CSV file download in the browser.
 * @param {string} csvString
 * @param {string} filename
 */
function downloadCSV(csvString, filename) {
  const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
