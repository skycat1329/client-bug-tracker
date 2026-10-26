import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  LucideIcon,
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Building2,
  Users,
  GitBranch,
  History,
  UserCheck,
  Hash,
  FileSpreadsheet,
  Layers,
  X,
  CheckSquare,
  FileSignature,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isPrimary?: boolean;
}

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  if (!user) return null;

  const isClient = user.role === 'client';
  const isDev = user.role === 'developer';
  const isManagerOrAdmin = ['support_manager', 'super_admin'].includes(user.role);
  const canManagePayroll = isManagerOrAdmin || !(!user.can_manage_payroll);

  const clientNav: NavItem[] = [
    { id: 'tickets', label: 'My Brand Tickets', icon: Ticket },
    { id: 'new-ticket', label: 'Report New Bug', icon: PlusCircle, isPrimary: true },
  ];

  const internalNav: NavItem[] = [
    { id: 'overview', label: 'Agency Overview', icon: LayoutDashboard },
    { id: 'tickets', label: 'All Tickets', icon: Ticket },
    ...(isDev || isManagerOrAdmin ? [{ id: 'my-tickets', label: 'My Assigned Tickets', icon: UserCheck }] : []),
    { id: 'tasks', label: 'Team Tasks & Deadlines', icon: CheckSquare },
    ...(canManagePayroll ? [{ id: 'payroll', label: 'Payroll & Offer Letters', icon: FileSignature }] : []),
    ...(isManagerOrAdmin
      ? [
          { id: 'queues', label: 'Ticket Queues', icon: Layers },
          { id: 'organizations', label: 'Brands & Websites', icon: Building2 },
          { id: 'team', label: 'Team & Developers', icon: Users },
          { id: 'routing', label: 'Routing Rules', icon: GitBranch },
          { id: 'sheets', label: 'Google Sheets Sync', icon: FileSpreadsheet },
        ]
      : []),
    { id: 'slack', label: 'Slack Integration', icon: Hash },
    { id: 'audit', label: 'Audit & Deliveries', icon: History },
  ];

  const items = isClient ? clientNav : internalNav;

  const handleItemClick = (id: string) => {
    onNavigate(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Brand / Mode Indicator */}
      <div className="mb-5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
          {isClient ? 'Client Portal Mode' : 'Developer & Agency Suite'}
        </div>
        <div className="text-sm font-bold text-slate-800 truncate mt-0.5">
          {isClient ? user.organization_name || 'My Organization' : 'Web Agency Command Center'}
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (currentView === 'ticket-detail' && item.id === 'tickets');
          const isPrimary = item.isPrimary;

          if (isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-4 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all shadow-blue-500/20 cursor-pointer"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                size={18}
                className={isActive ? 'text-blue-600' : 'text-slate-400'}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-400 px-3 flex items-center justify-between">
        <span>Assurance Media</span>
        <span className="text-slate-500 font-medium">Akash ❤️</span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col flex-shrink-0 h-[calc(100vh-3.5rem)] p-4">
        {navContent}
      </aside>

      {/* 2. Mobile Responsive Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Panel */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 p-4 flex flex-col animate-in slide-in-from-left duration-200">
            {/* Mobile Header with Close Button */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
              <button
                onClick={onCloseMobile}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {navContent}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
