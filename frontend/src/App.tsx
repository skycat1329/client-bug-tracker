import React, { useState, useEffect } from 'react';
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

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('tickets');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sync currentView when switching between client and internal roles (must be called unconditionally)
  useEffect(() => {
    if (user?.role === 'client') {
      if (!['tickets', 'new-ticket', 'ticket-detail'].includes(currentView)) {
        setCurrentView('tickets');
      }
    } else if (user && !['overview', 'tickets', 'my-tickets', 'ticket-detail', 'queues', 'organizations', 'team', 'routing', 'sheets', 'slack', 'audit'].includes(currentView)) {
      setCurrentView('overview');
    }
  }, [user, user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 animate-pulse">
          Loading Assurance Media Portal...
        </div>
      </div>
    );
  }

  const isBrandRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.includes('/brand') ||
      path.includes('/client') ||
      search.includes('portal=brand') ||
      search.includes('portal=client')
    );
  };

  if (!user) {
    if (isBrandRoute()) {
      return <BrandLoginPage />;
    }
    return <LoginPage />;
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

        <main className={`flex-1 overflow-y-auto bg-slate-50 ${isClient ? 'pb-16 sm:pb-0' : ''}`}>
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
              {currentView === 'organizations' && <OrganizationsPage />}
              {currentView === 'queues' && <QueuesPage />}
              {currentView === 'team' && <TeamPage />}
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
            <span className="text-base">🎫</span>
            <span className="text-[10px]">My Tickets</span>
          </button>

          <button
            onClick={() => {
              setSelectedTicketId(null);
              setCurrentView('new-ticket');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-md shadow-blue-500/30"
          >
            <span>+</span>
            <span>Report Bug</span>
          </button>

          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex flex-col items-center gap-0.5 text-xs font-semibold text-slate-500"
          >
            <span className="text-base">☰</span>
            <span className="text-[10px]">Menu</span>
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
