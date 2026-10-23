import React, { useState } from 'react';
import { ShieldAlert, Lock, ArrowLeft, Key, AlertTriangle, ShieldCheck } from 'lucide-react';

interface AdminSecurityGateProps {
  onUnlock: () => void;
  onReturnToBrand: () => void;
}

export const AdminSecurityGate: React.FC<AdminSecurityGateProps> = ({
  onUnlock,
  onReturnToBrand,
}) => {
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedOut) return;

    const trimmed = accessKey.trim();
    if (!trimmed) {
      setError('Please enter the Agency Master Security Passcode');
      return;
    }

    // Default Agency Security Passcode
    if (trimmed === 'assurance2026') {
      sessionStorage.setItem('agency_portal_unlocked', 'true');
      sessionStorage.setItem('agency_access_key', trimmed);
      setError(null);
      onUnlock();
    } else {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= 3) {
        setLockedOut(true);
        setError('Maximum failed attempts exceeded. Access locked for 30 seconds.');
        setTimeout(() => {
          setLockedOut(false);
          setAttempts(0);
          setError(null);
          onReturnToBrand();
        }, 30000);
      } else {
        setError(`Access Denied: Invalid Security Passcode (${3 - nextAttempts} attempts remaining)`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto py-10">
        {/* Shield Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mb-4 shadow-lg shadow-rose-500/10 animate-pulse">
            <ShieldAlert size={36} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 text-rose-300 text-[11px] font-bold uppercase tracking-wider border border-rose-800/40 mb-2">
            <Lock size={12} />
            <span>Restricted Gateway</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Agency Command Center
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            This internal terminal is strictly restricted to authorized Assurance Media engineering & triage personnel. Unauthorized access attempts are monitored and recorded.
          </p>
        </div>

        {/* Security Passcode Box */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Key size={14} className="text-amber-400" />
              <span>Agency Security Passcode</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">ENCRYPTED</span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Master Passcode
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="password"
                  disabled={lockedOut}
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="Enter Agency Security Key"
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={lockedOut}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} />
              <span>{lockedOut ? 'Locked Out' : 'Authenticate & Unlock Terminal'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onReturnToBrand}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Return to Client Brand Portal</span>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          <span>Assurance Media Security Architecture &bull; Client Brand Isolation Active</span>
        </div>
      </div>

      <footer className="py-3 text-center text-xs text-slate-600 border-t border-slate-900">
        <span>Made by</span> <strong className="text-slate-400">Akash</strong> <span>with</span> <span className="text-rose-500">❤️</span>
      </footer>
    </div>
  );
};
