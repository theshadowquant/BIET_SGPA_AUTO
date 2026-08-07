import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { auth } from './firebase/config';
import { verifyAdminAccess } from './firebase/services';
import toast from 'react-hot-toast';

import Navbar from './components/Navbar';
import StudentPage from './pages/StudentPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

// ─── Auth & Role Guarded Route ───────────────────────────────────────────────
function RequireAuth({ children }) {
  const [userState, setUserState] = useState({ loading: true, authenticated: false, adminProfile: null });
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        if (isMounted) setUserState({ loading: false, authenticated: false, adminProfile: null });
        return;
      }

      // Verify Firestore admin record + active status + role
      try {
        const verification = await verifyAdminAccess(u);
        if (!verification.authorized) {
          console.warn('[RequireAuth] Access denied:', verification.reason);
          await signOut(auth);
          toast.error(`Access Denied: ${verification.reason || 'Unauthorized'}`);
          if (isMounted) setUserState({ loading: false, authenticated: false, adminProfile: null });
          return;
        }

        if (isMounted) {
          setUserState({
            loading: false,
            authenticated: true,
            adminProfile: verification.adminRecord,
          });
        }
      } catch (err) {
        console.error('[RequireAuth] Security check error:', err);
        await signOut(auth);
        if (isMounted) setUserState({ loading: false, authenticated: false, adminProfile: null });
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  if (userState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Verifying Enterprise Security Access...</p>
        </div>
      </div>
    );
  }

  if (!userState.authenticated || !userState.adminProfile) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  return typeof children === 'function' ? children(userState.adminProfile) : children;
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: 'white' } },
        }}
      />
      <Navbar />
      <Routes>
        <Route path="/"       element={<StudentPage />} />
        <Route path="/admin"  element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAuth>
              {(adminProfile) => <AdminDashboard adminProfile={adminProfile} />}
            </RequireAuth>
          }
        />
        {/* Protected routes alias */}
        <Route path="/admin/settings"  element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/export"    element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/analytics" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/users"     element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/reports"   element={<Navigate to="/admin/dashboard" replace />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
