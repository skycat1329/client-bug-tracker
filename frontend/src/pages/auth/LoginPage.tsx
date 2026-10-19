import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Bug, Lock, Mail, AlertCircle, KeyRound, ShieldAlert } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@agency.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Salesforce Service Cloud Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-[#0176D3] text-white items-center justify-center shadow-lg shadow-blue-600/20 mb-3 border border-blue-400">
          <Bug size={32} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          BugTracker Pro
        </h2>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          Service Cloud Ticketing • Developer Command Center
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-sm border border-slate-200">
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Username / Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@agency.com"
                  className="w-full pl-9 pr-3.5 py-2.5 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-9 pr-3.5 py-2.5 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#0176D3] hover:bg-[#014486] text-white font-semibold text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In to Service Console'}
            </button>
          </form>

          {/* Quick Actions to fill Starter Admin or Developer */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Quick Credentials:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFillAdmin}
                  className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-medium py-1 px-2.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <KeyRound size={12} className="text-amber-500" />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={handleFillDeveloper}
                  className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-medium py-1 px-2.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <KeyRound size={12} className="text-emerald-500" />
                  <span>Developer</span>
                </button>
              </div>
            </div>

            <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
              <ShieldAlert size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <span>
                Client brand logins and developer accounts are provisioned directly by the Agency Administrator. Self-registration is restricted.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
