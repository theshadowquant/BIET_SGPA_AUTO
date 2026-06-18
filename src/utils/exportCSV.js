/**
 * CSV Export Utility
 * Client-side CSV generation — no backend required.
 */

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
 * Triggers a CSV file download.
 * @param {Array<Object>} data
 * @param {string} filename
 */
export function exportToCSV(data, filename = 'biet_results.csv') {
  const columns = [
    { key: 'name',      label: 'Student Name' },
    { key: 'usn',       label: 'USN' },
    { key: 'sgpa',      label: 'SGPA' },
    { key: 'timestamp', label: 'Submitted At' },
  ];

  const formatted = data.map(row => ({
    ...row,
    timestamp: row.timestamp?.toDate
      ? row.timestamp.toDate().toLocaleString('en-IN')
      : new Date(row.timestamp).toLocaleString('en-IN'),
  }));

  const csv = toCSV(formatted, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
