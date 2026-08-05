# Firestore Query Architecture Audit

## Root cause

The web application uses project `biet-sgpa-auto-2d3ff`, while `.firebaserc`
previously deployed indexes and rules to `biet-sgpa-auto`. Required composite
indexes could therefore be absent from the production database even though the
repository contained an indexes file. The deployment target now matches the web
application and curriculum seed script.

## Firestore operation inventory

| Location | Operations | Purpose |
|---|---|---|
| `src/firebase/services.js` | `writeBatch`, `set`, `serverTimestamp`, `increment` | Save a result and update global analytics atomically. |
| `src/firebase/services.js` | `query`, `where`, `orderBy`, `startAfter`, `limit`, `getDocs` | Student history, dashboard filtering/pagination, charts, and analytics. |
| `src/firebase/services.js` | `runTransaction`, `get`, `delete`, `set` | Delete a result and correct aggregates without a double-decrement race. |
| `src/firebase/services.js` | `getDoc`, `setDoc`, `writeBatch` | Curriculum reads, edits, and default seeding. |
| `src/firebase/services.js` | `onSnapshot`, `getDoc`, `writeBatch` | Analytics and visit tracking. |
| `seed_curriculum_cjs.cjs` | `writeBatch`, `set` | Standalone curriculum seed utility. |
| `migrate_result_timestamps.cjs` | `query`, `orderBy`, `documentId`, `startAfter`, `limit`, `getDocs`, `writeBatch` | Explicit one-time repair for legacy results without timestamps. |

There are no Firestore operations outside these files. `addDoc` was imported but
was never used and has been removed.

## Bugs found and fixed

1. Branch/semester filtering read only the newest 500 documents, then filtered
   in memory. Older matching records were invisible and the in-memory cursor was
   not a Firestore cursor.
2. USN pagination never used `startAfter`, so every next page repeated page one.
3. Combining USN with branch, semester, or SGPA silently used the 500-record
   fallback instead of the intended server-side filters.
4. A one-sided SGPA range was ignored.
5. `hasMore` was inferred from exactly 20 returned documents, creating a
   possible empty Next page. Queries now read 21 and display 20.
6. Concurrent dashboard requests could overwrite a newer filter result with a
   slower older request; pagination controls could issue duplicate requests.
7. Two administrators deleting the same result could decrement global analytics
   twice. Deletion now uses a transaction.
8. Daily usage was restricted to the newest 500 results, so high-volume recent
   traffic could hide records from the seven-day chart.
9. Distribution and leaderboard calculations had hard 200/500 ceilings. They
   now use a shared cursor-paged complete dataset instead of an arbitrary cap.
10. Documents without `timestamp` are omitted by every Firestore `orderBy` on
    that field. A safe migration script is supplied because a query cannot
    include both timestamped and missing-timestamp documents in one sorted
    result set.

## Query behavior

The records table applies every requested branch, semester, SGPA bound, and USN
filter to Firestore. USN is a normalized **prefix** search. Arbitrary substring
search cannot be served by Firestore indexes; it would require a maintained
search-token field or an external search system. Snapshot cursors are valid for
every filter combination and preserve deterministic continuation.

## Composite indexes added

`firestore.indexes.json` defines every query shape used by the records table:

- base range/order shapes: `usn,timestamp`; `sgpa,timestamp`; `usn,sgpa,timestamp`
- branch-only, semester-only, and branch+semester variants of timestamp ordering
- the same three equality variants for USN-prefix, SGPA-range, and combined
  USN-prefix+SGPA-range queries

This adds 15 records-table composite index shapes. The file also retains the
two pre-existing timestamp index definitions and existing single-field
overrides, for 17 collection-scope entries total. Automatic single-field
indexes cover the unfiltered timestamp ordering and seven-day timestamp query.

## Security and operational findings

- **Critical:** `/analytics/{docId}` currently permits public reads and writes.
  Any visitor can forge or erase counters.
- **High:** every authenticated Firebase user can read, edit, and delete all
  result records and can edit curriculum; authentication is not authorization.
  The rules have no custom-claim, allowlist, or server-side admin role.
- **High:** the previous `create_admin.js` embedded an admin email and password
  and targeted a different Firebase project. It now requires explicit process
  environment variables and contains no credential.
- Public client writes plus client-side rate limiting are not durable abuse
  protection. Real protection requires privileged server-side writes (for
  example, callable Cloud Functions) and rules that only permit the minimal
  public request path.

The last two findings cannot be fully remediated in Firestore rules alone while
anonymous clients must atomically create visits/results and increment analytics.
Moving those writes to trusted server code is required before tightening rules.

## Files modified

- `.firebaserc`
- `firestore.indexes.json`
- `src/firebase/services.js`
- `src/pages/AdminDashboard.jsx`
- `create_admin.js`
- `migrate_result_timestamps.cjs` (new)
- `FIRESTORE_AUDIT.md` (new)

## Breaking changes

- Dashboard USN search is now prefix search, rather than the old accidental
  substring search over only the newest 500 documents.
- `create_admin.js` now requires environment variables instead of embedded
  credentials.
- If legacy result documents lack a valid `timestamp`, run
  `migrate_result_timestamps.cjs` with an authenticated admin account before
  expecting them in timestamp-sorted dashboard views.
