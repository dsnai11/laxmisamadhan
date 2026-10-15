import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import TeamsManager from '@components/admin/TeamsManager';
import CategoryConfigManager from '@components/admin/CategoryConfigManager';
import { PageHeader, PageLoader } from '@components/common/ui';

export default function AdminTeams() {
  const { user } = useAuth();
  const { data: departments, isLoading } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments() });
  const [selected, setSelected] = useState('');
  const [activeTab, setActiveTab] = useState<'teams' | 'categories'>('teams');

  if (isLoading) return <PageLoader />;

  const isOrgWide = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');
  const isDeptHead = user?.role === 'DEPARTMENT_HEAD';
  const isTeamLead = user?.role === 'TEAM_LEAD';

  const list = departments || [];
  const departmentId = selected || (isOrgWide ? list[0]?.id : user?.departmentId) || '';
  const canManage = isOrgWide || (isDeptHead && departmentId === user?.departmentId) || isTeamLead;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams & Department Rules"
        subtitle={isTeamLead ? "Manage your teams, members, and category sub-issues" : "Group agents and configure sub-categories & sub-issues for ticket routing"}
        actions={
          isOrgWide ? (
            <select className="input" value={departmentId} onChange={(e) => setSelected(e.target.value)} aria-label="Department">
              {list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : undefined
        }
      />

      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <button
          type="button"
          className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'teams'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
          }`}
          onClick={() => setActiveTab('teams')}
        >
          Teams & Members
        </button>
        <button
          type="button"
          className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
          }`}
          onClick={() => setActiveTab('categories')}
        >
          Sub-Categories & Sub-Issues
        </button>
      </div>

      {activeTab === 'teams' ? (
        <TeamsManager 
          departmentId={departmentId} 
          canManage={canManage} 
          ownLeadId={isTeamLead ? user?.id : undefined} 
        />
      ) : (
        <CategoryConfigManager
          departmentId={departmentId}
          canManage={canManage}
        />
      )}
    </div>
  );
}
