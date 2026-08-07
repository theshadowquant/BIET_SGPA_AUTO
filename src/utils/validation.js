/**
 * Intelligent BIET Input Validation & Suspicious Name Detection Engine
 *
 * Uses multi-signal analysis to detect spam/keyboard mash/placeholder names while
 * eliminating false positives for Indian names (e.g. Shankar, Malleswari, Samarth, Sinchana).
 */

const KNOWN_PLACEHOLDERS = new Set([
  'abc', 'abcd', 'asdf', 'qwerty', 'zxcv', 'dfgh', 'hjkl', 'asdfgh', 'zxcvbn',
  'gfc', 'cvigi', 'xyz', 'aaaa', 'bbbb', 'cccc', 'dddd', 'xxxx', 'yyyy', 'zzzz',
  '111', '123', 'test', 'hello', 'admin', 'user', 'null', 'temp', 'sample',
  'jdhdb', 'hsh', 'hkgkg', 'asdfjkl', 'testing', 'dummy', 'fake', 'none',
]);

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

/**
 * Calculates a multi-signal Suspicious Confidence Score (0–100%) for a name.
 *
 * Signal Weights:
 *  • Known placeholder / keyboard mash: +80%
 *  • Contains digits or special characters: +50%
 *  • 3+ identical consecutive characters: +40%
 *  • Length ≥ 3 with ZERO vowels (e.g. "hsh", "gfc", "jdhdb"): +45%
 *  • 4+ consecutive consonants without vowel: +30%
 *  • Length < 3: +30%
 *
 * Classifications:
 *  0–30%   → Valid (Clean)
 *  31–60%  → Needs Review (Moderate confidence)
 *  61–100% → Suspicious (High confidence fake/spam)
 *
 * @param {string} name
 * @returns {{ score: number, category: 'valid' | 'needs_review' | 'suspicious', reasons: string[] }}
 */
export function calculateNameSuspicionScore(name) {
  if (!name || typeof name !== 'string') {
    return { score: 100, category: 'suspicious', reasons: ['Name is empty or invalid type'] };
  }

  const raw = name.trim();
  const lower = raw.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  let score = 0;
  const reasons = [];

  // 1. Direct placeholder or keyboard pattern match
  for (const word of words) {
    if (KNOWN_PLACEHOLDERS.has(word)) {
      score += 80;
      reasons.push(`Contains known placeholder/keyboard pattern "${word}"`);
    }
  }

  // 2. Contains digits or non-alpha special characters
  if (/[0-9]/.test(raw)) {
    score += 50;
    reasons.push('Contains numeric digits');
  }
  if (/[^A-Za-z\s.]/.test(raw)) {
    score += 40;
    reasons.push('Contains invalid special characters');
  }

  // 3. Repeated character spam (e.g. "aaaa", "xxxx", "hhhh")
  if (/(.)\1{2,}/.test(lower)) {
    score += 40;
    reasons.push('Contains 3+ repeated consecutive characters');
  }

  // 4. Word-level phonetics & vowel check
  for (const word of words) {
    // Ignore single letter initials like "V", "T", "N", "H", "P", "S"
    if (word.length <= 2) continue;

    const chars = word.split('');
    const hasVowel = chars.some(c => VOWELS.has(c));

    // Word >= 3 letters with zero vowels (e.g. "hsh", "gfc", "jdhdb", "hkgkg")
    if (!hasVowel) {
      score += 45;
      reasons.push(`Word "${word}" contains no vowels`);
    }

    // Check for 4+ consecutive consonants
    let maxConsonants = 0;
    let currentConsonants = 0;
    for (const c of chars) {
      if (/^[a-z]$/.test(c) && !VOWELS.has(c)) {
        currentConsonants++;
        if (currentConsonants > maxConsonants) maxConsonants = currentConsonants;
      } else {
        currentConsonants = 0;
      }
    }
    if (maxConsonants >= 4) {
      score += 30;
      reasons.push(`Word "${word}" has impossible consonant cluster (${maxConsonants} in a row)`);
    }
  }

  // 5. Total name length check
  if (raw.length < 3) {
    score += 35;
    reasons.push('Name is too short (< 3 characters)');
  }

  // Clamp score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score));

  let category = 'valid';
  if (finalScore >= 61) {
    category = 'suspicious';
  } else if (finalScore >= 31) {
    category = 'needs_review';
  }

  return { score: finalScore, category, reasons };
}

/**
 * Validates a student's full name at input time.
 * Accepts single-word Indian names (e.g. Shankar, Malleswari, Samarth, Sinchana)
 * while blocking high-confidence fake/spam entries (e.g. asdf, test, 123, hsh).
 *
 * @param {string} name
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateFullName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Please enter your full name.' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return {
      valid: false,
      error: 'Please enter a valid name (at least 2 letters).',
    };
  }

  // Calculate intelligent suspicion score
  const { score, category, reasons } = calculateNameSuspicionScore(trimmed);

  if (category === 'suspicious' || score >= 60) {
    return {
      valid: false,
      error: 'Please enter your full name as per college records (e.g. Rahul H K or Sinchana).',
    };
  }

  const ONLY_ALPHA = /^[A-Za-z\s.]+$/;
  if (!ONLY_ALPHA.test(trimmed)) {
    return {
      valid: false,
      error: 'Name must contain only letters. No numbers or special characters allowed.',
    };
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
