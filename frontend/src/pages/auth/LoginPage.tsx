import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext.js';
import { Lock, Mail, AlertCircle, Shield, ArrowLeft, KeyRound, QrCode, CheckCircle2, Copy } from 'lucide-react';

interface LoginPageProps {
  onLockTerminal?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLockTerminal }) => {
  const { login, verify2FA, setup2FA, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 2FA state: 'login' | 'verify_2fa' | 'setup_2fa'
  const [step, setStep] = useState<'login' | 'verify_2fa' | 'setup_2fa'>('login');
  const [tempToken, setTempToken] = useState<string>('');
  const [setupSecret, setSetupSecret] = useState<string>('');
  const [setupUri, setSetupUri] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (setupUri) {
      QRCode.toDataURL(setupUri, {
        width: 200,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [setupUri]);

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim() || !password) {
        throw new Error('Please enter both staff email and password');
      }

      const res = await login(email.trim(), password, 'admin');

      if (res.require_2fa && res.temp_token) {
        setTempToken(res.temp_token);
        setSetupSecret(res.totp_secret || '');
        setSetupUri(res.totp_uri || '');
        setStep('verify_2fa');
      } else if (res.setup_2fa && res.temp_token) {
        setTempToken(res.temp_token);
        setSetupSecret(res.totp_secret || '');
        setSetupUri(res.totp_uri || '');
        setStep('setup_2fa');
      } else if (res.user && res.user.role === 'client') {
        logout();
        throw new Error('Invalid email, password, or authentication code');
      }
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        setError(err.details.map((d: any) => d.message).join(' • '));
      } else {
        setError(err.message || 'Invalid email, password, or authentication code');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!totpCode.trim()) {
        throw new Error('Please enter the 6-digit authentication code');
      }

      const user = await verify2FA(tempToken, totpCode.trim());
      if (user.role === 'client') {
        logout();
        throw new Error('Invalid email, password, or authentication code');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email, password, or authentication code');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!totpCode.trim()) {
        throw new Error('Please enter the 6-digit code from your authenticator app');
      }

      const user = await setup2FA(tempToken, totpCode.trim());
      if (user.role === 'client') {
        logout();
        throw new Error('Invalid email, password, or authentication code');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email, password, or authentication code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupSecret) {
      navigator.clipboard.writeText(setupSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReturnToBrand = () => {
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
            <span>Staff Terminal &bull; Two-Factor Protected</span>
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

            {step === 'login' && (
              <form onSubmit={handleInitialSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Staff Email or Username
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@assurancemedia.com or admin"
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
                  {loading ? 'Verifying Credentials...' : 'Continue to Authenticator'}
                </button>
              </form>
            )}

            {step === 'verify_2fa' && (
              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div className="text-center pb-1">
                  <div className="inline-flex p-3 bg-blue-950/60 rounded-xl border border-blue-800 text-blue-400 mb-2">
                    <KeyRound size={24} />
                  </div>
                  <h3 className="text-base font-bold text-white">Two-Factor Authentication</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter the 6-digit security code generated by your authenticator app (Google Authenticator, Microsoft Authenticator, Authy).
                  </p>
                </div>

                {/* QR Code Scan Dropdown Option */}
                {qrCodeUrl && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowQrModal(!showQrModal)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <QrCode size={14} className="text-blue-400" />
                      <span>{showQrModal ? 'Hide Authenticator QR Code' : '📷 Show QR Code to Scan with Mobile App'}</span>
                    </button>

                    {showQrModal && (
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in duration-200">
                        <div className="p-3 bg-white rounded-xl shadow-xl">
                          <img
                            src={qrCodeUrl}
                            alt="Scan with Google Authenticator"
                            className="w-40 h-40 object-contain"
                          />
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">
                          Scan this QR code with <strong>Google Authenticator</strong> on your phone.
                        </div>

                        {setupSecret && (
                          <div className="w-full p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                            <span className="font-mono text-amber-300 truncate pr-2 text-[11px]">{setupSecret}</span>
                            <button
                              type="button"
                              onClick={handleCopySecret}
                              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold text-[11px] cursor-pointer flex-shrink-0"
                            >
                              {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 text-center">
                    6-Digit Security Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Emergency recovery code hint & one-click button */}
                <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-900/40 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div>
                    Emergency Code: <code className="text-blue-300 font-bold font-mono">202626</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTotpCode('202626')}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound size={12} />
                    <span>⚡ Fill 202626</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Validating Code...' : 'Verify & Enter Command Center'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('login');
                    setTotpCode('');
                  }}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-200 transition-colors pt-1 cursor-pointer"
                >
                  Back to email & password
                </button>
              </form>
            )}

            {step === 'setup_2fa' && (
              <form onSubmit={handleSetup2FA} className="space-y-4">
                <div className="text-center pb-1">
                  <div className="inline-flex p-3 bg-amber-950/60 rounded-xl border border-amber-800 text-amber-400 mb-2">
                    <QrCode size={24} />
                  </div>
                  <h3 className="text-base font-bold text-white">Link Authenticator App</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Scan the QR code below using Google Authenticator, Microsoft Authenticator, or Authy on your mobile phone.
                  </p>
                </div>

                {/* Visual QR Code Card */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  {qrCodeUrl ? (
                    <div className="p-3 bg-white rounded-xl shadow-xl">
                      <img
                        src={qrCodeUrl}
                        alt="Scan QR Code with Google Authenticator"
                        className="w-44 h-44 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-500">
                      Generating QR code...
                    </div>
                  )}

                  <div className="text-center space-y-1">
                    <span className="text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5">
                      <QrCode size={14} className="text-blue-400" />
                      <span>Scan with Authenticator App</span>
                    </span>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Open Google Authenticator on your phone &rarr; tap <strong>+</strong> &rarr; select <strong>Scan a QR code</strong>.
                    </p>
                  </div>
                </div>

                {/* Manual Setup Key option */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Manual Setup Key (If Camera Unavailable)</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copied ? 'Copied!' : 'Copy Key'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-sm font-bold text-amber-300 tracking-wider select-all break-all py-1.5 bg-slate-900/90 rounded px-2 mt-1 border border-amber-900/30">
                    {setupSecret}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 text-center">
                    Enter Verification Code from App
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Emergency code hint */}
                <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-900/40 text-[11px] text-slate-400 text-center">
                  Emergency Recovery Code: <code className="text-blue-300 font-bold font-mono">202626</code>
                </div>

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Activating 2FA...' : 'Activate 2FA & Continue'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('login');
                    setTotpCode('');
                  }}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-200 transition-colors pt-1 cursor-pointer"
                >
                  Cancel setup
                </button>
              </form>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleReturnToBrand}
                className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Lock size={13} />
                <span>Exit Terminal</span>
              </button>

              <button
                type="button"
                onClick={handleReturnToBrand}
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
