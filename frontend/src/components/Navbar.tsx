import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, Bug, ChevronDown, Check, UserCircle2, Shield, Code, UserCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, switchDemoUser, demoUsers } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    support_manager: 'Support Manager',
    developer: 'Developer',
    client: 'Client Portal',
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield size={12} className="text-purple-600" />;
      case 'support_manager':
        return <UserCheck size={12} className="text-blue-600" />;
      case 'developer':
        return <Code size={12} className="text-emerald-600" />;
      default:
        return <UserCircle2 size={12} className="text-amber-600" />;
    }
  };

  const roleColors: Record<string, string> = {
    super_admin: 'bg-purple-50 text-purple-700 border-purple-200',
    support_manager: 'bg-blue-50 text-blue-700 border-blue-200',
    developer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    client: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <header className="h-14 bg-[#0176D3] text-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-md">
      {/* Brand & Title (Salesforce Lightning Header style) */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/20 transition-colors">
          <Bug size={18} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-base tracking-tight">BugTracker Pro</span>
          <span className="hidden md:inline-block text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-white/15 text-white/90 border border-white/20">
            Service Cloud • Agency Suite
          </span>
        </div>
      </div>

      {/* Right Controls: User Profile & Quick Switcher */}
      {user && (
        <div className="flex items-center gap-3" ref={dropdownRef}>
          {/* Quick Account Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-white text-[#0176D3] font-bold flex items-center justify-center text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-bold truncate max-w-[140px] leading-tight">{user.name}</div>
                <div className="text-[10px] text-white/80 leading-tight">
                  {user.custom_role || roleLabels[user.role] || user.role}
                </div>
              </div>
              <ChevronDown size={14} className="text-white/70" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="text-[11px] uppercase font-bold text-slate-400">Currently Active User</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{user.name}</div>
                  <div className="text-xs text-slate-500 font-mono truncate">{user.email}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border capitalize">
                    {getRoleIcon(user.role)}
                    <span>{user.custom_role || roleLabels[user.role] || user.role}</span>
                    {user.organization_name && <span>• {user.organization_name}</span>}
                  </div>
                </div>

                <div className="px-3 py-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-2 mb-1">
                    ⚡ Instant Switch Account
                  </div>

                  <button
                    onClick={async () => {
                      setDropdownOpen(false);
                      await switchDemoUser('admin@agency.com');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors ${
                      user.email === 'admin@agency.com' ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-purple-600" />
                      <div className="text-left">
                        <div className="leading-tight font-semibold">Agency Administrator</div>
                        <div className="text-[10px] text-slate-400 font-mono">admin@agency.com</div>
                      </div>
                    </div>
                    {user.email === 'admin@agency.com' && <Check size={14} className="text-blue-600" />}
                  </button>

                  <button
                    onClick={async () => {
                      setDropdownOpen(false);
                      await switchDemoUser('dev@agency.com');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors mt-0.5 ${
                      user.email === 'dev@agency.com' ? 'bg-emerald-50 font-bold text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Code size={14} className="text-emerald-600" />
                      <div className="text-left">
                        <div className="leading-tight font-semibold">Alex Developer</div>
                        <div className="text-[10px] text-slate-400 font-mono">dev@agency.com</div>
                      </div>
                    </div>
                    {user.email === 'dev@agency.com' && <Check size={14} className="text-emerald-600" />}
                  </button>

                  {/* Other demo/client users */}
                  {demoUsers
                    .filter((u) => u.email !== 'admin@agency.com' && u.email !== 'dev@agency.com')
                    .slice(0, 4)
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={async () => {
                          setDropdownOpen(false);
                          await switchDemoUser(u.email);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors mt-0.5 ${
                          user.email === u.email ? 'bg-amber-50 font-bold text-amber-700' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserCircle2 size={14} className="text-amber-600" />
                          <div className="text-left truncate max-w-[170px]">
                            <div className="leading-tight font-semibold truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{u.email}</div>
                          </div>
                        </div>
                        {user.email === u.email && <Check size={14} className="text-amber-600" />}
                      </button>
                    ))}
                </div>

                <div className="pt-2 px-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
