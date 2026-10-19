import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { BrandLoginPage } from './BrandLoginPage.js';
import { Lock, Mail, AlertCircle, KeyRound, ShieldAlert, Building2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  
  // Detect if url is /brand or /client or has ?portal=brand
  const [portalMode, setPortalMode] = useState<'staff' | 'brand'>(() => {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    if (path.includes('/brand') || path.includes('/client') || search.includes('portal=brand')) {
      return 'brand';
    }
    return 'staff';
  });

  const [email, setEmail] = useState('admin@agency.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for hash or url changes if any
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/brand') || path.includes('/client')) {
        setPortalMode('brand');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (portalMode === 'brand') {
    return <BrandLoginPage />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim() || !password) {
        throw new Error('Please enter both email and password');
      }
      await login(email.trim(), password);
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        setError(err.details.map((d: any) => d.message).join(' • '));
      } else {
        setError(err.message || 'Invalid credentials. Please verify your login details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setEmail('admin@agency.com');
    setPassword('admin123');
    setError(null);
  };

  const handleFillDeveloper = () => {
    setEmail('dev@agency.com');
    setPassword('dev123');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          {/* Assurance Media Official Logo */}
          <div className="inline-flex p-3 bg-white rounded-2xl shadow-sm border border-slate-200 mb-4">
            <img
              src="/assurance-media-logo.jpg"
              alt="Assurance Media"
              className="h-12 object-contain"
            />
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Agency Command Center
          </h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Developer Triage & Support Suite • Assurance Media
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-md border border-slate-200 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Staff Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@agency.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In to Command Center'}
              </button>
            </form>

            {/* Link to Brand Login Page */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
                <Building2 size={16} className="text-blue-600 flex-shrink-0" />
                <span>Are you a Client Brand?</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.history.pushState(null, '', '/brand/login');
                  setPortalMode('brand');
                }}
                className="text-xs bg-white hover:bg-blue-600 text-blue-700 hover:text-white font-bold px-3 py-1.5 rounded-lg border border-blue-300 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                Go to Brand Login &rarr;
              </button>
            </div>

            {/* Quick Actions for testing */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Quick Demo Accounts:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillAdmin}
                    className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-semibold py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <KeyRound size={12} className="text-amber-500" />
                    <span>Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFillDeveloper}
                    className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-semibold py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <KeyRound size={12} className="text-emerald-500" />
                    <span>Developer</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
                <ShieldAlert size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <span>
                  All client passwords and brand accounts are isolated. Brand clients will be prompted to reset their initial temporary password on first login.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Footer */}
      <footer className="py-4 px-4 bg-white border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
        <span>Made by</span> <strong className="text-slate-700">Akash</strong> <span>with</span> <span className="text-rose-500 text-sm">❤️</span>
      </footer>
    </div>
  );
};
