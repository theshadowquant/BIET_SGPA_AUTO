/**
 * Security & Anti-Brute-Force Rate Limiter
 *
 * Handles:
 *  1. Student submission rate limiting (60s cooldown per USN)
 *  2. Admin login rate limiting (max 5 failed attempts per 15 mins per browser)
 *  3. CSV export rate limiting (30s cooldown per export)
 */

const RATE_LIMIT_KEY = 'biet_rate_limits';
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

const LOGIN_ATTEMPTS_KEY = 'biet_login_attempts';
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const EXPORT_LIMIT_KEY = 'biet_export_limits';
const EXPORT_COOLDOWN_MS = 30 * 1000; // 30 seconds

/**
 * Checks if a USN is within the student submission rate limit window.
 * @param {string} usn
 * @returns {{ allowed: boolean, remainingMs: number }}
 */
export function checkRateLimit(usn) {
  const key = usn.toUpperCase().trim();
  const store = JSON.parse(sessionStorage.getItem(RATE_LIMIT_KEY) || '{}');
  const lastSubmit = store[key];

  if (!lastSubmit) return { allowed: true, remainingMs: 0 };

  const elapsed = Date.now() - lastSubmit;
  const remainingMs = RATE_LIMIT_WINDOW_MS - elapsed;

  if (remainingMs > 0) {
    return { allowed: false, remainingMs };
  }

  return { allowed: true, remainingMs: 0 };
}

/**
 * Records a submission timestamp for a USN.
 * @param {string} usn
 */
export function recordSubmission(usn) {
  const key = usn.toUpperCase().trim();
  const store = JSON.parse(sessionStorage.getItem(RATE_LIMIT_KEY) || '{}');

  const now = Date.now();
  for (const k in store) {
    if (now - store[k] > RATE_LIMIT_WINDOW_MS) {
      delete store[k];
    }
  }

  store[key] = now;
  sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(store));
}

/**
 * Admin Login Anti-Brute-Force Check.
 * Returns { allowed: boolean, attempts: number, lockoutRemainingMs: number }
 */
export function checkLoginRateLimit() {
  const store = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{"attempts": 0, "firstAttempt": 0, "lockedUntil": 0}');
  const now = Date.now();

  if (store.lockedUntil && now < store.lockedUntil) {
    return {
      allowed: false,
      attempts: store.attempts,
      lockoutRemainingMs: store.lockedUntil - now,
    };
  }

  // If lockout or window has expired, reset
  if (store.firstAttempt && now - store.firstAttempt > LOGIN_LOCKOUT_MS) {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    return { allowed: true, attempts: 0, lockoutRemainingMs: 0 };
  }

  return { allowed: true, attempts: store.attempts || 0, lockoutRemainingMs: 0 };
}

/**
 * Record a failed admin login attempt.
 */
export function recordFailedLoginAttempt() {
  const store = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{"attempts": 0, "firstAttempt": 0, "lockedUntil": 0}');
  const now = Date.now();

  const attempts = (store.attempts || 0) + 1;
  const firstAttempt = store.firstAttempt || now;
  let lockedUntil = 0;

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    lockedUntil = now + LOGIN_LOCKOUT_MS;
  }

  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({
    attempts,
    firstAttempt,
    lockedUntil,
  }));

  return { attempts, lockedUntil };
}

/**
 * Clear admin login attempts upon successful authentication.
 */
export function clearLoginAttempts() {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

/**
 * CSV Export Rate Limiter Check.
 */
export function checkExportRateLimit() {
  const lastExport = Number(sessionStorage.getItem(EXPORT_LIMIT_KEY) || 0);
  const now = Date.now();
  const elapsed = now - lastExport;
  const remainingMs = EXPORT_COOLDOWN_MS - elapsed;

  if (remainingMs > 0) {
    return { allowed: false, remainingMs };
  }

  return { allowed: true, remainingMs: 0 };
}

/**
 * Record a CSV export timestamp.
 */
export function recordExport() {
  sessionStorage.setItem(EXPORT_LIMIT_KEY, String(Date.now()));
}

/**
 * Formats remaining cooldown time as human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatCooldown(ms) {
  const secs = Math.ceil(ms / 1000);
  if (secs > 60) {
    const mins = Math.ceil(secs / 60);
    return `${mins}m`;
  }
  return `${secs}s`;
}
