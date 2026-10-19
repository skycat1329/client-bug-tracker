import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Building2, Lock, Mail, AlertCircle, ArrowRight, Shield, CheckCircle } from 'lucide-react';

interface BrandLoginPageProps {
  onSwitchToStaff?: () => void;
}

export const BrandLoginPage: React.FC<BrandLoginPageProps> = ({ onSwitchToStaff }) => {
  const { login } = useAuth();
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
        throw new Error('Please enter both your brand email and password');
      }
      await login(email.trim(), password);
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        setError(err.details.map((d: any) => d.message).join(' • '));
      } else {
        setError(err.message || 'Invalid brand credentials. Please check your email or temporary password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-slate-50 to-slate-100 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          {/* Official Assurance Media Logo */}
          <div className="inline-flex p-3 bg-white rounded-2xl shadow-sm border border-slate-200 mb-4">
            <img
              src="/assurance-media-logo.jpg"
              alt="Assurance Media"
              className="h-12 object-contain"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider mb-2">
            <Building2 size={13} />
            <span>Dedicated Brand & Client Portal</span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Sign In to Your Brand Portal
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Report issues, monitor developer triage, and review website bug fixes in real time.
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-md border border-slate-200 space-y-6">
            {/* First-time help banner */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
              <Shield size={16} className="flex-shrink-0 mt-0.5 text-blue-600" />
              <div className="leading-relaxed">
                <strong>First-time sign in?</strong> Use the initial temporary password sent to your email by Assurance Media. You will be prompted to set your permanent password immediately.
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Brand Contact Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@yourbrand.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <span className="text-[11px] text-slate-400">Temporary or permanent</span>
                </div>
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
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer mt-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Brand Portal'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-2 text-center">
              <span className="text-xs text-slate-500">Are you an internal team member?</span>
              <button
                type="button"
                onClick={onSwitchToStaff}
                className="text-xs text-[#0066CC] hover:text-[#004d99] font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Switch to Agency & Developer Login &rarr;</span>
              </button>
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
