import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';

export const ForceResetPasswordPage: React.FC = () => {
  const { user, forceResetPassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      await forceResetPassword(newPassword);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const meetsLength = newPassword.length >= 8;
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
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
            Mandatory Security Setup
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Welcome, <strong className="text-slate-800">{user?.name || user?.email}</strong>
            {user?.organization_name && (
              <span className="block text-blue-600 font-semibold mt-0.5">
                {user.organization_name}
              </span>
            )}
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl shadow-md border border-slate-200 space-y-6">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <ShieldCheck size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong className="font-bold">Password Reset Required:</strong>
                <p className="mt-0.5 text-amber-700 leading-relaxed">
                  You are logging in with a temporary initial password. For the security of your brand and tickets, please choose a new permanent password before proceeding.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Permanent Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password checklist */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={14}
                    className={meetsLength ? 'text-emerald-600' : 'text-slate-300'}
                  />
                  <span className={meetsLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                    At least 8 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={14}
                    className={matches ? 'text-emerald-600' : 'text-slate-300'}
                  />
                  <span className={matches ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                    Passwords match exactly
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !meetsLength || !matches}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>{submitting ? 'Updating Security Credentials...' : 'Save Password & Enter Portal'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                <LogOut size={13} />
                <span>Sign Out & Return Later</span>
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
