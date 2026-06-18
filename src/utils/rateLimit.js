/**
 * Rate Limiter — prevents duplicate submissions per USN within 60 seconds.
 * Uses sessionStorage so it resets on tab close but persists across page reloads.
 */

const RATE_LIMIT_KEY = 'biet_rate_limits';
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Checks if a USN is within the rate limit window.
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

  // Prune expired entries to keep storage lean
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
 * Formats remaining cooldown time as human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatCooldown(ms) {
  const secs = Math.ceil(ms / 1000);
  return `${secs}s`;
}
