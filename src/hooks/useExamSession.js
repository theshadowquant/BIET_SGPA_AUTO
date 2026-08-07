import { useState, useEffect } from 'react';
import { getExamSession } from '../firebase/services';

/** Fallback values used when admin has not yet configured the session */
export const DEFAULT_SESSION = {
  examTitle: 'SEE Examination',
  examMonth: 'June–July',
  examYear: '2026',
};

/** Build the full display string, e.g. "SEE Examination, June–July 2026" */
export function formatExamSession(session) {
  const s = session || DEFAULT_SESSION;
  return `${s.examTitle}, ${s.examMonth} ${s.examYear}`;
}

// Module-level cache so only one Firestore read happens per page load
let sessionCache = null;
let pendingListeners = [];
let fetchStarted = false;

function notifyAll(data) {
  sessionCache = data;
  pendingListeners.forEach(fn => fn(data));
  pendingListeners = [];
  fetchStarted = false;
}

/** Invalidate the cache (called after admin saves a new session) */
export function invalidateExamSessionCache() {
  sessionCache = null;
  fetchStarted = false;
}

/**
 * useExamSession — React hook
 *
 * Reads the current exam session from Firestore `settings/examSession`.
 * Returns DEFAULT_SESSION immediately and updates once the read completes.
 * Uses a shared in-memory cache: only one Firestore read per browser session
 * regardless of how many components mount this hook.
 *
 * @returns {{ examTitle: string, examMonth: string, examYear: string }}
 */
export function useExamSession() {
  const [session, setSession] = useState(sessionCache || DEFAULT_SESSION);

  useEffect(() => {
    // Already cached — use it instantly
    if (sessionCache) {
      setSession(sessionCache);
      return;
    }

    // Register as a pending listener
    let mounted = true;
    const listener = (data) => { if (mounted) setSession(data); };
    pendingListeners.push(listener);

    // Only one component kicks off the fetch
    if (!fetchStarted) {
      fetchStarted = true;
      getExamSession()
        .then(data => notifyAll(data || DEFAULT_SESSION))
        .catch(() => notifyAll(DEFAULT_SESSION));
    }

    return () => {
      mounted = false;
      pendingListeners = pendingListeners.filter(fn => fn !== listener);
    };
  }, []);

  return session;
}
