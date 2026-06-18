import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { motion } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, LogIn, GraduationCap, Mail, Lock } from 'lucide-react';
import { auth } from '../firebase/config';
import toast from 'react-hot-toast';


export default function AdminLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Welcome back, Admin!');
      navigate('/admin/dashboard');
    } catch (err) {
      const msg = {
        'auth/user-not-found':   'No admin account found with this email',
        'auth/wrong-password':   'Incorrect password',
        'auth/invalid-email':    'Invalid email address',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/invalid-credential': 'Invalid credentials',
      }[err.code] ?? 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-16 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* ─── Glowing Mesh Background Orbs ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -40, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[10%] -left-[10%] w-[350px] h-[350px] md:w-[500px] md:h-[500px] rounded-full bg-blue-400/15 blur-[80px] md:blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -30, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-[10%] -right-[10%] w-[350px] h-[350px] md:w-[500px] md:h-[500px] rounded-full bg-teal-300/15 blur-[80px] md:blur-[120px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[420px] z-10"
      >
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 2 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/25 mb-4"
          >
            <GraduationCap className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800" style={{ fontWeight: 900 }}>
            Admin Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium tracking-wide">
            BIET Analytics Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_24px_70px_-15px_rgba(59,130,246,0.12)] rounded-3xl p-8 md:p-10">
          
          {/* Status Message */}
          <div className="flex items-start gap-3 mb-8 px-4 py-3.5 rounded-2xl bg-blue-50/50 border border-blue-100/50">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 font-semibold leading-relaxed">
              Restricted access — authorized administrators only
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 tracking-widest uppercase block ml-0.5" htmlFor="admin-email">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-3 bg-white/50 border border-slate-200/80 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-200"
                  placeholder="admin@biet.edu.in"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 tracking-widest uppercase block ml-0.5" htmlFor="admin-password">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="admin-password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full pl-11 pr-11 py-3 bg-white/50 border border-slate-200/80 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-200"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              id="admin-login-btn"
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/35 transition-all duration-250 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed text-sm mt-8"
              disabled={loading}
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-xs font-semibold text-slate-400 mt-8 leading-relaxed px-4">
          Bapuji Institute of Engineering &amp; Technology<br />
          <span className="text-[10px] text-slate-400/80 font-medium mt-1 block">Autonomous · VTU Affiliated</span>
        </p>
      </motion.div>
    </div>
  );
}
