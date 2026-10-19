import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { LoginPage } from './pages/auth/LoginPage.js';

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

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('tickets');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500 animate-pulse">
          Loading BugTracker Pro...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isClient = user.role === 'client';

  const handleSelectTicket = (id: string) => {
    setSelectedTicketId(id);
    setCurrentView('ticket-detail');
  };

  const handleBackToTickets = () => {
    setSelectedTicketId(null);
    setCurrentView('tickets');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            setSelectedTicketId(null);
            setCurrentView(view);
          }}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {/* Customer Portal Views */}
          {isClient && (
            <>
              {currentView === 'tickets' && (
                <CustomerTicketsPage
                  onSelectTicket={handleSelectTicket}
                  onNewTicket={() => setCurrentView('new-ticket')}
                />
              )}
              {currentView === 'new-ticket' && (
                <NewTicketPage
                  onTicketCreated={(id) => handleSelectTicket(id)}
                  onCancel={() => setCurrentView('tickets')}
                />
              )}
              {currentView === 'ticket-detail' && selectedTicketId && (
                <CustomerTicketDetailPage
                  ticketId={selectedTicketId}
                  onBack={handleBackToTickets}
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
    </div>
  );
};
