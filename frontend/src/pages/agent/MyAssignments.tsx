import { useState } from 'react';
import { useAuth } from '@context/AuthContext';
import api from '@services/api';
import TicketListPage from '@components/tickets/TicketListPage';
import TeamsManager from '@components/admin/TeamsManager';

export default function MyAssignments() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'assignments' | 'my-team'>('assignments');
  const isTeamLead = user?.role === 'TEAM_LEAD';

  if (!isTeamLead) {
    // Regular agents see only their ticket assignments
    return (
      <TicketListPage
        title="My Assignments"
        subtitle="Tickets assigned to you"
        queryKey="my-assignments"
        fetcher={(params) => api.getAssignedTickets(params)}
        basePath="/agent/tickets"
        showRaiser
        emptyMessage="Nothing is assigned to you right now. Take a ticket from the queue."
      />
    );
  }

  // Team leads can also manage their team
  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 -mb-px" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'assignments'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Assignments
          </button>
          <button
            onClick={() => setActiveTab('my-team')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'my-team'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Manage My Team
          </button>
        </nav>
      </div>

      {activeTab === 'assignments' && (
        <TicketListPage
          title="My Assignments"
          subtitle="Tickets assigned to you"
          queryKey="my-assignments"
          fetcher={(params) => api.getAssignedTickets(params)}
          basePath="/agent/tickets"
          showRaiser
          emptyMessage="Nothing is assigned to you right now. Take a ticket from the queue."
        />
      )}


      {activeTab === 'my-team' && user?.departmentId && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Manage My Team</h1>
            <p className="text-sm text-gray-500 mt-1">Add or remove members from your team. You can only manage your own team.</p>
          </div>
          <TeamsManager departmentId={user.departmentId} canManage={true} ownLeadId={user.id} />
        </div>
      )}
    </div>
  );
}
