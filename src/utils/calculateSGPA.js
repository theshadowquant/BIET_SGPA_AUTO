/**
 * BIET SGPA Calculation Engine
 * Pure function — zero side effects, fully testable
 */

export const SUBJECTS = [
  { key: 'ada',      code: 'BCSPCC401',  label: 'Analysis and Design of Algorithms',                 alias: 'ADA',           credits: 4, hasLab: false },
  { key: 'advJava',  code: 'BCSPCC402',  label: 'Advanced Java',                                     alias: 'Adv. Java',     credits: 4, hasLab: false },
  { key: 'dbms',     code: 'BCSPCC403',  label: 'Database Management Systems',                        alias: 'DBMS',          credits: 4, hasLab: false },
  { key: 'dms',      code: 'BCSESC404A', label: 'Discrete Mathematical Structures and Graph Theory',  alias: 'DMS',           credits: 3, hasLab: false },
  { key: 'biology',  code: 'BBTBIO405',  label: 'Biology for Engineers',                             alias: 'Biology',       credits: 2, hasLab: false },
  { key: 'adaLab',   code: 'BCSPCL406',  label: 'Analysis And Design of Algorithms Lab',              alias: 'ADA Lab',       credits: 1, hasLab: true  },
  { key: 'gitLab',   code: 'BCSAEC407A', label: 'Version Control with GIT-Lab',                       alias: 'Git Lab',       credits: 1, hasLab: true  },
  { key: 'evs',      code: 'BHSENV408',  label: 'Environmental Studies',                             alias: 'EVS',           credits: 1, hasLab: false },
  { key: 'pe',       code: 'BMNPHE409',  label: 'Physical Education',                                alias: 'PE',            credits: 0, hasLab: false },
];

// Only countable subjects (credits > 0)
export const SCORABLE_SUBJECTS = SUBJECTS.filter(s => s.credits > 0);

/**
 * Maps marks to VTU grade point
 * @param {number} marks - 0 to 100
 * @returns {number} gradePoint
 */
export function marksToGradePoint(marks) {
  const m = Number(marks);
  if (m >= 90) return 10;
  if (m >= 80) return 9;
  if (m >= 70) return 8;
  if (m >= 60) return 7;
  if (m >= 50) return 6;
  return 0; // F — Below 50
}

/**
 * Maps grade point to letter grade
 * @param {number} gp
 * @returns {string}
 */
export function gradePointToLetter(gp) {
  switch (gp) {
    case 10: return 'O';   // Outstanding
    case 9:  return 'A+';
    case 8:  return 'A';
    case 7:  return 'B+';
    case 6:  return 'B';
    default: return 'F';
  }
}

/**
 * Returns CSS class for grade badge
 * @param {number} gp
 */
export function gradeClass(gp) {
  if (gp >= 9) return 'badge-excellent';
  if (gp >= 7) return 'badge-good';
  if (gp >= 6) return 'badge-average';
  return 'badge-fail';
}

/**
 * Returns strength label for a subject
 * @param {number} gp
 */
export function strengthLabel(gp) {
  if (gp >= 9) return 'strong';   // highlight green
  if (gp >= 6) return 'neutral';
  return 'weak';                   // highlight red (F)
}

/**
 * Main SGPA calculation engine
 *
 * @param {Object} marksMap - { [subjectKey]: number } (0–100 per subject)
 * @returns {{
 *   sgpa: number,
 *   totalCredits: number,
 *   totalWeightedPoints: number,
 *   breakdown: Array<{
 *     key, label, credits, marks, gradePoint, grade, strength, contribution
 *   }>,
 *   hasF: boolean,
 *   strongSubjects: string[],
 *   weakSubjects: string[]
 * }}
 */
export function calculateSGPA(marksMap) {
  let totalWeightedPoints = 0;
  let totalCredits = 0;
  const breakdown = [];

  for (const subject of SCORABLE_SUBJECTS) {
    const marks = Number(marksMap[subject.key] ?? 0);
    const gp = marksToGradePoint(marks);
    const contribution = subject.credits * gp;

    totalWeightedPoints += contribution;
    totalCredits += subject.credits;

    breakdown.push({
      key: subject.key,
      code: subject.code,
      label: subject.label,
      alias: subject.alias,
      credits: subject.credits,
      marks,
      gradePoint: gp,
      grade: gradePointToLetter(gp),
      strength: strengthLabel(gp),
      contribution,
    });
  }

  // PE (0-credit) — still show in breakdown for completeness
  const pe = SUBJECTS.find(s => s.key === 'pe');
  const peMarks = Number(marksMap['pe'] ?? 0);
  breakdown.push({
    key: 'pe',
    code: pe.code,
    label: pe.label,
    alias: pe.alias,
    credits: 0,
    marks: peMarks,
    gradePoint: marksToGradePoint(peMarks),
    grade: gradePointToLetter(marksToGradePoint(peMarks)),
    strength: 'neutral',
    contribution: 0,
    excluded: true,
  });

  const sgpa = totalCredits > 0
    ? parseFloat((totalWeightedPoints / totalCredits).toFixed(2))
    : 0;

  const hasF = breakdown.some(s => !s.excluded && s.gradePoint === 0);
  const strongSubjects = breakdown.filter(s => s.strength === 'strong').map(s => s.alias || s.label);
  const weakSubjects   = breakdown.filter(s => s.strength === 'weak').map(s => s.alias || s.label);

  return {
    sgpa,
    totalCredits,
    totalWeightedPoints,
    breakdown,
    hasF,
    strongSubjects,
    weakSubjects,
  };
}

/**
 * Validates marks input before saving to Firestore
 * @param {Object} marksMap
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateMarks(marksMap) {
  const errors = {};
  for (const subject of SUBJECTS) {
    const rawValue = marksMap[subject.key];
    const isCredit = subject.credits > 0;

    if (isCredit) {
      const v = Number(rawValue);
      if (rawValue === undefined || rawValue === '' || isNaN(v) || v < 0 || v > 100) {
        errors[subject.key] = `Must be 0–100`;
      }
    } else {
      if (rawValue !== undefined && rawValue !== '') {
        const v = Number(rawValue);
        if (isNaN(v) || v < 0 || v > 100) {
          errors[subject.key] = `Must be 0–100`;
        }
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
