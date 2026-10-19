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
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { user } = useAuth();
  if (!user) return null;

  const isClient = user.role === 'client';
  const isDev = user.role === 'developer';
  const isManagerOrAdmin = ['support_manager', 'super_admin'].includes(user.role);

  const clientNav: NavItem[] = [
    { id: 'tickets', label: 'My Brand Tickets', icon: Ticket },
    { id: 'new-ticket', label: 'Report New Bug', icon: PlusCircle, isPrimary: true },
  ];

  const internalNav: NavItem[] = [
    { id: 'overview', label: 'Agency Overview', icon: LayoutDashboard },
    { id: 'tickets', label: 'All Tickets', icon: Ticket },
    ...(isDev || isManagerOrAdmin ? [{ id: 'my-tickets', label: 'My Assigned Tickets', icon: UserCheck }] : []),
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

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-[calc(100vh-4rem)] p-4">
      {/* Brand / Mode Indicator */}
      <div className="mb-6 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {isClient ? 'Client Portal Mode' : 'Developer & Agency Suite'}
        </div>
        <div className="text-sm font-bold text-slate-800 truncate mt-0.5">
          {isClient ? user.organization_name || 'My Organization' : 'Web Agency Command Center'}
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (currentView === 'ticket-detail' && item.id === 'tickets');
          const isPrimary = item.isPrimary;

          if (isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-4 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all shadow-blue-500/20"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
    </aside>
  );
};
