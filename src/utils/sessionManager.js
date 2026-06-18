/**
 * Session Manager
 * Handles visit deduplication: 1 visit record per session per 24 hours.
 * Uses localStorage for persistence across tabs + page reloads.
 */

const SESSION_KEY = 'biet_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generates a random session ID.
 * @returns {string}
 */
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Gets or creates a session ID.
 * Returns the session ID and whether it needs to be recorded in Firestore.
 *
 * @returns {{ sessionId: string, needsRecord: boolean }}
 */
export function getOrCreateSession() {
  const stored = localStorage.getItem(SESSION_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const age = Date.now() - parsed.createdAt;

      if (age < SESSION_TTL_MS) {
        // Session still valid — needs record if it wasn't successfully saved before
        return { 
          sessionId: parsed.sessionId, 
          needsRecord: !parsed.isRecorded 
        };
      }
    } catch {
      // Corrupted storage — reset
    }
  }

  // Create new session
  const sessionId = generateSessionId();
  const sessionData = {
    sessionId,
    createdAt: Date.now(),
    isRecorded: false,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  return { sessionId, needsRecord: true };
}

/**
 * Marks the current session as recorded in Firestore to prevent duplicate counts.
 */
export function markSessionAsRecorded() {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      parsed.isRecorded = true;
      localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore
    }
  }
}

/**
 * Returns device info for visit tracking.
 * @returns {Object}
 */
export function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent.slice(0, 200), // cap length
    platform: navigator.platform || 'unknown',
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}
