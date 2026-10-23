import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Lock, Mail, AlertCircle, Shield, ArrowLeft } from 'lucide-react';

interface LoginPageProps {
  onLockTerminal?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLockTerminal }) => {
  const { login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim() || !password) {
        throw new Error('Please enter both staff email and password');
      }

      const agencyKey = sessionStorage.getItem('agency_access_key') || 'assurance2026';
      const loggedInUser = await login(email.trim(), password, 'admin', agencyKey);

      if (loggedInUser.role === 'client') {
        logout();
        throw new Error('Access Denied: Brand client accounts are strictly prohibited from logging into the Agency Command Center.');
      }
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        setError(err.details.map((d: any) => d.message).join(' • '));
      } else {
        setError(err.message || 'Invalid staff credentials or unauthorized role.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem('agency_portal_unlocked');
    sessionStorage.removeItem('agency_access_key');
    if (onLockTerminal) {
      onLockTerminal();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          {/* Assurance Media Official Logo */}
          <div className="inline-flex p-3 bg-white rounded-2xl shadow-sm border border-slate-700 mb-4">
            <img
              src="/assurance-media-logo.jpg"
              alt="Assurance Media"
              className="h-12 object-contain"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-800/50">
            <Shield size={13} className="text-blue-400" />
            <span>Staff Terminal &bull; Authenticated Access</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Agency Command Center
          </h2>
          <p className="mt-1 text-sm text-slate-400 font-medium">
            Developer Triage & Support Suite &bull; Assurance Media
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-slate-900/95 py-8 px-5 sm:px-10 rounded-2xl shadow-2xl border border-slate-800 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-rose-400" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Staff Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@agency.com"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? 'Authenticating Personnel...' : 'Sign In to Command Center'}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleLock}
                className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Lock size={13} />
                <span>Lock Terminal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <ArrowLeft size={13} />
                <span>Brand Portal</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Footer */}
      <footer className="py-4 px-4 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
        <span>Made by</span> <strong className="text-slate-400">Akash</strong> <span>with</span> <span className="text-rose-500 text-sm">❤️</span>
      </footer>
    </div>
  );
};
