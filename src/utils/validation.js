/**
 * BIET Input Validation Utilities — used client-side AND mirrored in Firestore rules.
 * Pure functions, zero side-effects.
 */

/**
 * Validates a student's full name.
 *
 * Rules:
 *  • Minimum 4 characters total
 *  • At least 2 words (first name + last name or initial)
 *  • Each word contains only alphabetic characters (A-Z, a-z)
 *  • Initials are allowed (single uppercase letters, e.g. "V", "T")
 *
 * Valid:   "LEKHAN V T", "Sania S Mishrikoti", "Manoj H P", "Rahul Bisalahalli"
 * Invalid: "Hsh", "abc", "123", "Jai", "xxxx", "J", "a b"
 *
 * @param {string} name
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateFullName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required.' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 4) {
    return {
      valid: false,
      error: 'Please enter your full name as per college records (e.g. Rahul H K).',
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return {
      valid: false,
      error: 'Please enter your full name with at least first and last name (e.g. Rahul Kumar).',
    };
  }

  const ONLY_ALPHA = /^[A-Za-z]+$/;
  for (const word of words) {
    if (!ONLY_ALPHA.test(word)) {
      return {
        valid: false,
        error: 'Name must contain only letters. No numbers or special characters allowed.',
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Validates a BIET USN.
 *
 * Format: 4BD{YY}{CC}{NNN}
 *   4BD  = College code (fixed)
 *   YY   = 2-digit admission year (e.g. 24)
 *   CC   = 2-letter branch code (e.g. CD, CS, EC)
 *   NNN  = 3-digit roll number (001–999)
 *
 * Valid:   4BD24CD001, 4BD23CS100, 4BD22EC050
 * Invalid: random, 24CD001, 4BD020, abc123, 4BD24CD1 (too short)
 *
 * @param {string} usn
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateUSN(usn) {
  if (!usn || typeof usn !== 'string') {
    return { valid: false, error: 'USN is required.' };
  }

  const trimmed = usn.trim().toUpperCase();

  if (trimmed.length === 0) {
    return { valid: false, error: 'USN is required.' };
  }

  if (trimmed.length !== 10) {
    return {
      valid: false,
      error: `USN must be exactly 10 characters (e.g. 4BD24CD001). Got ${trimmed.length}.`,
    };
  }

  const USN_REGEX = /^4BD[0-9]{2}[A-Z]{2}[0-9]{3}$/;
  if (!USN_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid USN format. Expected: 4BD24CD001 (College Code + Year + Branch + Roll No.)',
    };
  }

  return { valid: true, error: null };
}

/**
 * Sanitizes a student name for Firestore storage.
 * Trims outer whitespace, collapses internal spaces, preserves casing.
 *
 * @param {string} name
 * @returns {string}
 */
export function sanitizeName(name) {
  return (name || '').trim().replace(/\s+/g, ' ');
}

/**
 * Sanitizes a USN for Firestore storage.
 * Uppercases and strips all whitespace.
 *
 * @param {string} usn
 * @returns {string}
 */
export function sanitizeUSN(usn) {
  return (usn || '').toUpperCase().replace(/\s/g, '');
}

/**
 * Checks if two student names refer to the same person.
 * Case-insensitive and whitespace-normalized comparison.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function namesMatch(a, b) {
  return sanitizeName(a).toLowerCase() === sanitizeName(b).toLowerCase();
}
