import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Ticket, UserCheck, Menu, PlusCircle, Clock } from 'lucide-react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { LoginPage } from './pages/auth/LoginPage.js';
import { BrandLoginPage } from './pages/auth/BrandLoginPage.js';
import { ForceResetPasswordPage } from './pages/auth/ForceResetPasswordPage.js';

// Client pages
import { CustomerTicketsPage } from './pages/customer/CustomerTicketsPage.js';
import { NewTicketPage } from './pages/customer/NewTicketPage.js';
import { CustomerTicketDetailPage } from './pages/customer/CustomerTicketDetailPage.js';

// Internal pages
import { AdminDashboardPage } from './pages/internal/AdminDashboardPage.js';
import { InternalTicketListPage } from './pages/internal/InternalTicketListPage.js';
import { InternalTicketDetailPage } from './pages/internal/InternalTicketDetailPage.js';
import { OrganizationsPage } from './pages/internal/OrganizationsPage.js';
import { TeamPage } from './pages/internal/TeamPage.js';
import { RoutingRulesPage } from './pages/internal/RoutingRulesPage.js';
import { SlackHealthPage } from './pages/internal/SlackHealthPage.js';
import { AuditLogsPage } from './pages/internal/AuditLogsPage.js';
import { GoogleSheetsPage } from './pages/internal/GoogleSheetsPage.js';
import { QueuesPage } from './pages/internal/QueuesPage.js';
import { TasksPage } from './pages/internal/TasksPage.js';
import { PayrollDocumentsPage } from './pages/internal/PayrollDocumentsPage.js';
import { AttendancePage } from './pages/internal/AttendancePage.js';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('tickets');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAdminRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.includes('/admin') ||
      path.includes('/agency') ||
      path.includes('/staff') ||
      search.includes('portal=admin')
    );
  };

  // Strict route & view jailing for client brands
  useEffect(() => {
    if (user?.role === 'client') {
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        path.includes('/admin') ||
        path.includes('/agency') ||
        path.includes('/staff') ||
        search.includes('portal=admin')
      ) {
        window.history.replaceState(null, '', '/');
      }
      if (!['tickets', 'new-ticket', 'ticket-detail'].includes(currentView)) {
        setCurrentView('tickets');
      }
    } else if (
      user &&
      ![
        'overview',
        'attendance',
        'tickets',
        'my-tickets',
        'ticket-detail',
        'queues',
        'organizations',
        'team',
        'routing',
        'sheets',
        'slack',
        'audit',
        'tasks',
        'payroll',
      ].includes(currentView)
    ) {
      setCurrentView('overview');
    }
  }, [user, user?.role, currentView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 animate-pulse">
          Loading Assurance Media Portal...
        </div>
      </div>
    );
  }

  // Unauthenticated user routing:
  // Brand Login is the STRICT DEFAULT for all visitors.
  // Staff Command Center is rendered on /admin, /staff, or ?portal=admin.
  if (!user) {
    if (isAdminRoute()) {
      return (
        <LoginPage
          onLockTerminal={() => {
            window.history.replaceState(null, '', '/');
            window.location.href = '/';
          }}
        />
      );
    }

    // Default for everyone: Dedicated Client Brand Portal
    return <BrandLoginPage />;
  }

  // Mandatory first-time password reset gate
  const requiresPasswordReset =
    user.must_reset_password === true ||
    user.must_reset_password === 1 ||
    (user.must_reset_password as unknown) === '1';

  if (requiresPasswordReset) {
    return <ForceResetPasswordPage />;
  }

  const isClient = user.role === 'client';

  const handleSelectTicket = (id: string) => {
    setSelectedTicketId(id);
    setCurrentView('ticket-detail');
    setMobileNavOpen(false);
  };

  const handleBackToTickets = () => {
    setSelectedTicketId(null);
    setCurrentView('tickets');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <Navbar onToggleMobileMenu={() => setMobileNavOpen((prev) => !prev)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            setSelectedTicketId(null);
            setCurrentView(view);
            setMobileNavOpen(false);
          }}
          isMobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50 pb-16 sm:pb-0">
          {/* Customer Portal Views */}
          {isClient && (
            <>
              {currentView === 'new-ticket' ? (
                <NewTicketPage
                  onTicketCreated={(id) => handleSelectTicket(id)}
                  onCancel={() => setCurrentView('tickets')}
                />
              ) : currentView === 'ticket-detail' && selectedTicketId ? (
                <CustomerTicketDetailPage
                  ticketId={selectedTicketId}
                  onBack={handleBackToTickets}
                />
              ) : (
                <CustomerTicketsPage
                  onSelectTicket={handleSelectTicket}
                  onNewTicket={() => setCurrentView('new-ticket')}
                />
              )}
            </>
          )}

          {/* Internal Staff Views */}
          {!isClient && (
            <>
              {currentView === 'overview' && (
                <AdminDashboardPage
                  onSelectTicket={handleSelectTicket}
                  onNavigate={setCurrentView}
                />
              )}
              {currentView === 'tickets' && (
                <InternalTicketListPage
                  initialFilter="all"
                  onSelectTicket={handleSelectTicket}
                />
              )}
              {currentView === 'my-tickets' && (
                <InternalTicketListPage
                  initialFilter="my-tickets"
                  onSelectTicket={handleSelectTicket}
                />
              )}
              {currentView === 'ticket-detail' && selectedTicketId && (
                <InternalTicketDetailPage
                  ticketId={selectedTicketId}
                  onBack={handleBackToTickets}
                />
              )}
              {currentView === 'attendance' && <AttendancePage />}
              {currentView === 'organizations' && <OrganizationsPage />}
              {currentView === 'queues' && <QueuesPage />}
              {currentView === 'team' && <TeamPage />}
              {currentView === 'tasks' && <TasksPage />}
              {currentView === 'payroll' && <PayrollDocumentsPage />}
              {currentView === 'routing' && <RoutingRulesPage />}
              {currentView === 'sheets' && <GoogleSheetsPage />}
              {currentView === 'slack' && <SlackHealthPage />}
              {currentView === 'audit' && (
                <AuditLogsPage onSelectTicket={handleSelectTicket} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar for Brand Clients */}
      {isClient && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center justify-around shadow-lg">
          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentView('tickets');
            }}
            className={`flex flex-col items-center gap-0.5 text-xs font-semibold ${
              currentView === 'tickets' || (currentView === 'ticket-detail')
                ? 'text-blue-600'
                : 'text-slate-500'
            }`}
          >
            <Ticket size={18} />
            <span className="text-[10px]">My Tickets</span>
          </button>

          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentView('new-ticket');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-md shadow-blue-500/30"
          >
            <PlusCircle size={15} />
            <span>Report Bug</span>
          </button>

          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex flex-col items-center gap-0.5 text-xs font-semibold text-slate-500"
          >
            <Menu size={18} />
            <span className="text-[10px]">Menu</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar for Internal Staff (Darwinbox Mobile App Experience) */}
      {!isClient && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-between shadow-xl">
          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentView('overview');
            }}
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-semibold transition-colors ${
              currentView === 'overview' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard size={18} />
            <span className="text-[10px] mt-0.5 font-bold">Home</span>
          </button>

          {/* Darwinbox Prime Action: Clock-In */}
          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentView('attendance');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold shadow-md transition-all ${
              currentView === 'attendance'
                ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-400/50'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-600/25 active:scale-95'
            }`}
          >
            <Clock size={15} className="animate-pulse" />
            <span>Punch Clock</span>
          </button>

          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentView('tickets');
            }}
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-semibold transition-colors ${
              currentView === 'tickets' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Ticket size={18} />
            <span className="text-[10px] mt-0.5 font-bold">Queues</span>
          </button>

          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentView('tasks');
            }}
            className={`flex flex-col items-center py-1 px-2 rounded-lg text-xs font-semibold transition-colors ${
              currentView === 'tasks' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserCheck size={18} />
            <span className="text-[10px] mt-0.5 font-bold">Tasks</span>
          </button>

          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex flex-col items-center py-1 px-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <Menu size={18} />
            <span className="text-[10px] mt-0.5 font-bold">Menu</span>
          </button>
        </div>
      )}

      {/* Mandatory Global Footer */}
      <footer className="hidden sm:flex py-2.5 px-4 bg-white border-t border-slate-200 text-center text-xs text-slate-500 items-center justify-center gap-1 z-10 flex-shrink-0">
        <span>Made by</span> <strong className="text-slate-700">Akash</strong> <span>with</span> <span className="text-rose-500 text-sm">❤️</span>
      </footer>
    </div>
  );
};
