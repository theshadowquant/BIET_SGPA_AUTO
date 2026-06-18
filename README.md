# BIET SGPA Calculator & Admin Analytics Portal

**Bapuji Institute of Engineering and Technology (Autonomous, VTU Affiliated)**

A production-grade React/Firebase web application for calculating student SGPA and managing academic records via a secure admin analytics portal.

---

## ✨ Features

| Module | Capabilities |
|---|---|
| **Student Calculator** | VTU grade mapping, marks split mode, instant SGPA, PDF/Print/Share |
| **Result Dashboard** | Animated SGPA ring, subject breakdown, strong/weak highlights |
| **Student History** | Past 5 results retrieved via USN |
| **Admin Portal** | Firebase Auth login, real-time metrics, paginated table |
| **Analytics** | SGPA distribution chart, 7-day usage area chart |
| **Data Controls** | USN search, SGPA range filter, CSV export, record delete |
| **Performance** | Batched writes, cursor pagination, debounced filters, rate limiting |
| **Security** | Strict Firestore rules, schema validation, session deduplication |

---

## 🗂️ Project Structure

```
src/
├── firebase/
│   ├── config.js          # Firebase init + env validation
│   └── services.js        # All Firestore read/write logic
├── utils/
│   ├── calculateSGPA.js   # Pure SGPA engine (VTU grade mapping)
│   ├── rateLimit.js       # 60s per-USN submission throttle
│   ├── sessionManager.js  # Visit dedup (1 per session/24h)
│   └── exportCSV.js       # Client-side CSV generation
├── components/
│   ├── Navbar.jsx
│   ├── SubjectForm.jsx    # Marks entry (total or int+ext split)
│   ├── ResultCard.jsx     # Animated SGPA ring + stats
│   ├── SubjectTable.jsx   # Staggered grade breakdown table
│   ├── SkeletonLoader.jsx # Loading skeletons
│   └── charts/
│       ├── SGPADistChart.jsx
│       └── DailyUsageChart.jsx
├── pages/
│   ├── StudentPage.jsx    # Main calculator page
│   ├── AdminLogin.jsx     # Firebase Auth login
│   └── AdminDashboard.jsx # Analytics + records portal
└── App.jsx                # Router + auth guard
```

---

## 🚀 Local Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd GPA_Calculator
npm install
```

### 2. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project**, name it (e.g., `biet-sgpa`)
3. Enable **Google Analytics** (optional)

### 3. Enable Firestore

1. Firebase Console → **Build → Firestore Database**
2. Click **Create database** → **Start in production mode**
3. Select region: `asia-south1` (India)

### 4. Enable Firebase Authentication

1. **Build → Authentication → Get started**
2. Enable **Email/Password** sign-in method
3. **Users tab → Add user** → create your admin account

### 5. Configure Environment Variables

```bash
cp .env.example .env
```

Fill `.env` with your Firebase project values from **Project Settings → Your Apps → Web app → SDK config**:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 6. Deploy Firestore Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project, accept defaults
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 7. Run Locally

```bash
npm run dev
```

Open http://localhost:5173

---

## 🌐 Deploy to Vercel

### Vercel Dashboard (Recommended)

1. Push code to GitHub
2. Go to vercel.com → **New Project** → import your repo
3. **Settings → Environment Variables** → add all `VITE_FIREBASE_*` keys
4. Click **Deploy**

Vercel auto-detects Vite. Build: `npm run build`, Output: `dist/`

---

## 🔐 Firestore Security Rules Summary

| Collection | Public Create | Admin Read | Admin Delete |
|---|---|---|---|
| `results` | YES (schema validated) | YES | YES |
| `analytics/global` | Batched only | YES | YES |
| `visits` | YES (once per session) | YES | YES |

---

## Performance Architecture

| Concern | Solution |
|---|---|
| 2000+ concurrent users | Firestore scales automatically |
| Avg SGPA accuracy | Derived: sgpaSum / totalCalculations |
| Spam writes | 60s per-USN rate limit (sessionStorage) |
| Visit spam | 1 write per session/24h (localStorage TTL) |
| Costly reads | Cursor-based pagination (20/page) |
| Analytics reads | Single document, real-time listener |
| Filter debouncing | 500ms debounce on inputs |

---

## VTU Grade Scale

| Marks | Grade | Grade Points |
|---|---|---|
| 90-100 | O (Outstanding) | 10 |
| 80-89 | A+ | 9 |
| 70-79 | A | 8 |
| 60-69 | B+ | 7 |
| 50-59 | B | 6 |
| Less than 50 | F (Fail) | 0 |

SGPA Formula: Sum(Credit x Grade Point) / Sum(Credits)

---

## Tech Stack

React 18 + Vite 5, Tailwind CSS 4, Framer Motion, Firebase 10 (Firestore + Auth),
Recharts, html2pdf.js, React Router v6, React Hot Toast, Lucide React

---

## Admin Access

Navigate to /admin to login with Firebase Auth credentials.

Made with purpose for BIET - Autonomous - VTU Affiliated
