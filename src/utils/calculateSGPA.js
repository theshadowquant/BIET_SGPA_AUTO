/**
 * BIET SGPA Calculation Engine
 * Pure function — zero side effects, fully testable
 */

/**
 * Maps marks to VTU grade point
 * @param {number} marks - 0 to 100
 * @returns {number} gradePoint
 */
export function marksToGradePoint(marks, { cieMarks, seeMarks, useComponentPassing = false } = {}) {
  const m = Number(marks);
  // In CIE + SEE mode a subject must clear every statutory component as well
  // as the 50/100 aggregate requirement.
  if (useComponentPassing && (Number(cieMarks) < 20 || Number(seeMarks) < 18)) return 0;
  if (m >= 90) return 10;
  if (m >= 80) return 9;
  if (m >= 70) return 8;
  if (m >= 60) return 7;
  if (m >= 55) return 6;
  if (m >= 50) return 5;
  if (m >= 40) return 4;
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
    case 5:  return 'C';
    case 4:  return 'P';
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
  if (gp >= 4) return 'badge-average';
  return 'badge-fail';
}

/**
 * Returns strength label for a subject
 * @param {number} gp
 */
export function strengthLabel(gp) {
  if (gp >= 9) return 'strong';   // highlight green
  if (gp >= 4) return 'neutral';
  return 'weak';                   // highlight red (F)
}

/**
 * Main SGPA calculation engine
 *
 * @param {Object} marksMap - { [subjectKey]: number } (0–100 per subject)
 * @param {Array} subjectsList - The dynamically configured subjects list
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
export function calculateSGPA(marksMap, subjectsList, { useComponentPassing = false } = {}) {
  let totalWeightedPoints = 0;
  let totalCredits = 0;
  const breakdown = [];

  const scorable = (subjectsList || []).filter(s => s.credits > 0);
  const nonCredit = (subjectsList || []).filter(s => s.credits === 0);

  for (const subject of scorable) {
    const marks = Number(marksMap[subject.key] ?? 0);
    const cieMarks = marksMap[`${subject.key}_int`];
    const seeMarks = marksMap[`${subject.key}_ext`];
    const usesComponents = useComponentPassing && Number(subject.credits) > 0;
    const gp = marksToGradePoint(marks, { cieMarks, seeMarks, useComponentPassing: usesComponents });
    const contribution = subject.credits * gp;

    totalWeightedPoints += contribution;
    totalCredits += subject.credits;

    breakdown.push({
      key: subject.key,
      code: subject.code,
      label: subject.label,
      alias: subject.alias || subject.label,
      credits: subject.credits,
      marks,
      cieMarks: usesComponents ? Number(cieMarks) : undefined,
      seeMarks: usesComponents ? Number(seeMarks) : undefined,
      componentFailed: usesComponents && (Number(cieMarks) < 20 || Number(seeMarks) < 18),
      gradePoint: gp,
      grade: gradePointToLetter(gp),
      strength: strengthLabel(gp),
      contribution,
    });
  }

  // Non-credit subjects (0-credit, e.g. PE)
  for (const subject of nonCredit) {
    const marks = Number(marksMap[subject.key] ?? 0);
    breakdown.push({
      key: subject.key,
      code: subject.code,
      label: subject.label,
      alias: subject.alias || subject.label,
      credits: 0,
      marks,
      gradePoint: null,
      grade: 'PP',
      strength: 'neutral',
      contribution: 0,
      excluded: true,
    });
  }

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
 * @param {Array} subjectsList
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateMarks(marksMap, subjectsList, { useComponentPassing = false } = {}) {
  const errors = {};
  for (const subject of (subjectsList || [])) {
    const rawValue = marksMap[subject.key];
    const isCredit = subject.credits > 0;

    if (isCredit) {
      if (useComponentPassing) {
        const cie = Number(marksMap[`${subject.key}_int`]);
        const see = Number(marksMap[`${subject.key}_ext`]);
        if (marksMap[`${subject.key}_int`] === '' || marksMap[`${subject.key}_ext`] === '' || !Number.isFinite(cie) || !Number.isFinite(see) || cie < 0 || cie > 50 || see < 0 || see > 50) {
          errors[subject.key] = 'Enter CIE and SEE marks from 0–50';
          continue;
        }
      }
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
