import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Role } from '../../types/index.js';
import {
  Users,
  UserPlus,
  Shield,
  Code,
  UserCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Plus,
  Eye,
  Key,
  Edit2,
  Lock,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'super_admin' | 'support_manager' | 'developer';
  custom_role?: string | null;
  created_at: string;
  active_tickets_count?: number;
}

export const TeamPage: React.FC = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'visibility'>('members');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'developer',
    custom_role: '',
  });

  // Edit Member Modal
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'developer',
    custom_role: '',
    password: '',
    must_reset_password: true,
    send_email: false,
  });

  // Add Custom Role Modal
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({
    name: '',
    label: '',
    description: '',
    color: 'blue',
    base_role: 'developer' as 'developer' | 'support_manager' | 'super_admin',
  });

  // Visibility Policy Settings
  const [triagePolicy, setTriagePolicy] = useState({
    triage_required_for_team: true,
    allowed_roles: ['super_admin', 'support_manager'],
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Delete Member state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setError(null);
    try {
      const [staffRes, rolesRes, visRes] = await Promise.allSettled([
        api.get<{ staff: TeamMember[] }>('/auth/staff'),
        api.get<{ roles: Role[] }>('/auth/roles'),
        api.get<{ policy: any }>('/auth/settings/visibility'),
      ]);

      if (staffRes.status === 'fulfilled') {
        setTeam(staffRes.value.staff || []);
      } else {
        console.error('Staff load failed:', staffRes.reason);
      }

      if (rolesRes.status === 'fulfilled') {
        setRoles(rolesRes.value.roles || []);
      } else {
        console.error('Roles load failed:', rolesRes.reason);
      }

      if (visRes.status === 'fulfilled' && visRes.value.policy) {
        setTriagePolicy(visRes.value.policy);
      }
    } catch (err: any) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      // Find selected role to set base role + custom_role
      const selectedRoleObj = roles.find((r) => r.name === memberForm.role);
      const baseRole = selectedRoleObj ? selectedRoleObj.base_role : memberForm.role;
      const customRoleLabel = selectedRoleObj && !selectedRoleObj.is_system ? selectedRoleObj.label : undefined;

      await api.post('/auth/create-user', {
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        phone: memberForm.phone.trim() || undefined,
        password: memberForm.password,
        role: baseRole,
        custom_role: customRoleLabel || memberForm.custom_role.trim() || undefined,
      });

      setSuccess(`Account for ${memberForm.name} created successfully! Login credentials have been automatically emailed to ${memberForm.email}.`);
      setMemberForm({ name: '', email: '', phone: '', password: '', role: 'developer', custom_role: '' });
      setShowAddMemberModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create team member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the agency team? Open tickets will be unassigned.`)) {
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      try {
        await api.delete(`/auth/staff/${id}`);
      } catch (delErr: any) {
        // Fallback to POST /delete in case DELETE method was intercepted by server proxy
        await api.post(`/auth/staff/${id}/delete`);
      }
      setSuccess(`Team member ${name} was removed successfully.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete team member');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setEditMemberForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      role: member.role,
      custom_role: member.custom_role || '',
      password: '',
      must_reset_password: true,
      send_email: false,
    });
    setShowEditMemberModal(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const selectedRoleObj = roles.find((r) => r.name === editMemberForm.role);
      const baseRole = selectedRoleObj ? selectedRoleObj.base_role : editMemberForm.role;
      const customRoleLabel = selectedRoleObj && !selectedRoleObj.is_system ? selectedRoleObj.label : undefined;

      const payload: any = {
        name: editMemberForm.name.trim(),
        email: editMemberForm.email.trim(),
        phone: editMemberForm.phone.trim() || null,
        role: baseRole,
        custom_role: customRoleLabel || editMemberForm.custom_role.trim() || null,
      };

      if (editMemberForm.password.trim()) {
        payload.password = editMemberForm.password.trim();
        payload.must_reset_password = editMemberForm.must_reset_password ? 1 : 0;
        payload.send_email = editMemberForm.send_email;
      }

      await api.put(`/auth/users/${editingMember.id}`, payload);

      setSuccess(`Team member "${editMemberForm.name}" updated successfully!`);
      setShowEditMemberModal(false);
      setEditingMember(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update team member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      await api.post('/auth/roles', {
        name: roleForm.name.trim(),
        label: roleForm.label.trim(),
        description: roleForm.description.trim(),
        color: roleForm.color,
        base_role: roleForm.base_role,
      });

      setSuccess(`Custom role "${roleForm.label}" created successfully!`);
      setRoleForm({ name: '', label: '', description: '', color: 'blue', base_role: 'developer' });
      setShowAddRoleModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (id: string, label: string) => {
    if (!confirm(`Delete custom role "${label}"?`)) return;
    try {
      try {
        await api.delete(`/auth/roles/${id}`);
      } catch (delErr: any) {
        await api.post(`/auth/roles/${id}/delete`);
      }
      setSuccess(`Role "${label}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete role');
    }
  };

  const handleSaveVisibilityPolicy = async () => {
    setSavingPolicy(true);
    setError(null);
    try {
      await api.post('/auth/settings/visibility', triagePolicy);
      setSuccess('Triage visibility policies updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update visibility policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  const getRoleBadge = (role: string, custom_role?: string | null) => {
    if (custom_role) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
          <Code size={12} />
          {custom_role}
        </span>
      );
    }

    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield size={12} />
            Super Admin
          </span>
        );
      case 'support_manager':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <UserCheck size={12} />
            Support Manager
          </span>
        );
      case 'developer':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Code size={12} />
            Developer
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="text-[#0176D3]" />
            Agency Team, Custom Roles & Triage Control
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage developers, triage specialists, custom authorization roles, and ticket visibility policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'members' && (
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <UserPlus size={16} />
              <span>Add Team Member</span>
            </button>
          )}

          {activeTab === 'roles' && (
            <button
              onClick={() => setShowAddRoleModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus size={16} />
              <span>Create Custom Role</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-sm font-medium">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors ${
            activeTab === 'members'
              ? 'border-[#0176D3] text-[#0176D3]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={16} />
          <span>Team Members ({team.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors ${
            activeTab === 'roles'
              ? 'border-[#0176D3] text-[#0176D3]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key size={16} />
          <span>Custom Roles & Permissions ({roles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('visibility')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors ${
            activeTab === 'visibility'
              ? 'border-[#0176D3] text-[#0176D3]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders size={16} />
          <span>Triage & Ticket Visibility Controls</span>
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>
              {error.toLowerCase().includes('token') || error.toLowerCase().includes('authentication')
                ? 'Your session has expired. Please sign in again to continue.'
                : error}
            </span>
          </div>
          {(error.toLowerCase().includes('token') ||
            error.toLowerCase().includes('authentication') ||
            error.toLowerCase().includes('expired')) && (
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.reload();
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm flex-shrink-0 transition-colors"
            >
              Sign in again
            </button>
          )}
        </div>
      )}

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Active Internal Personnel</h2>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {team.length} Members
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading team roster...</div>
          ) : team.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No team members registered.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Name</th>
                    <th className="py-3 px-6">Email / Login</th>
                    <th className="py-3 px-6">Role / Title</th>
                    <th className="py-3 px-6 text-center">Active Assigned</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.map((member) => {
                    const isRootAdmin = member.email === 'admin@agency.com';
                    return (
                      <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span>{member.name}</span>
                              {isRootAdmin && (
                                <span className="ml-2 text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  Primary Root Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                          <div>{member.email}</div>
                          {member.phone && (
                            <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5 font-sans">
                              <span>💬</span>
                              <span>{member.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6">{getRoleBadge(member.role, member.custom_role)}</td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                              (member.active_tickets_count || 0) > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {member.active_tickets_count || 0} Open
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditMember(member)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-white hover:bg-slate-700 border border-slate-300 rounded-md transition-colors"
                              title="Edit Member Details & Password"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                            {!isRootAdmin ? (
                              <button
                                disabled={deletingId === member.id}
                                onClick={() => handleDeleteMember(member.id, member.name)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-md transition-colors disabled:opacity-50"
                                title="Delete Team Member"
                              >
                                <Trash2 size={13} />
                                <span>{deletingId === member.id ? 'Deleting...' : 'Delete'}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Protected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ROLES */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Custom Roles & Permissions Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define specialized titles and roles (e.g. QA Lead, Tier 2 Triage, Release Engineer).
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {roles.length} Roles Defined
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors bg-white flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      {r.is_system ? <Shield size={14} className="text-slate-400" /> : <Code size={14} className="text-teal-600" />}
                      {r.label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.is_system ? 'bg-slate-100 text-slate-600' : 'bg-teal-100 text-teal-800'}`}>
                      {r.is_system ? 'System Role' : 'Custom Role'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mb-3">
                    {r.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Base: <strong className="text-slate-700 capitalize">{r.base_role}</strong></span>
                  {!r.is_system && (
                    <button
                      onClick={() => handleDeleteRole(r.id, r.label)}
                      className="text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: VISIBILITY CONTROLS */}
      {activeTab === 'visibility' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
            <Eye className="text-[#0176D3] mt-1" size={24} />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ticket Triage & Team Visibility Gate
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure whether new tickets must be triaged first before regular developers and team members can see them.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triagePolicy.triage_required_for_team}
                  onChange={(e) =>
                    setTriagePolicy({ ...triagePolicy, triage_required_for_team: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 text-[#0176D3] rounded border-slate-300 focus:ring-[#0176D3]"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Require Triage Before Ticket is Visible to General Team
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    When enabled, newly created tickets (status <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">NEW</code>) are ONLY visible to authorized Triagers/Managers. Regular developers and team members will only see tickets once they have been triaged (status <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">TRIAGED</code> or later) or assigned directly to them.
                  </div>
                </div>
              </label>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Roles Authorized to Access Untriaged (NEW) Tickets
              </h3>
              <div className="space-y-2 text-xs">
                {['super_admin', 'support_manager', 'developer'].map((roleKey) => {
                  const isChecked = triagePolicy.allowed_roles.includes(roleKey);
                  return (
                    <label key={roleKey} className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...triagePolicy.allowed_roles, roleKey]
                            : triagePolicy.allowed_roles.filter((r) => r !== roleKey);
                          setTriagePolicy({ ...triagePolicy, allowed_roles: next });
                        }}
                        className="w-4 h-4 text-[#0176D3] rounded border-slate-300 focus:ring-[#0176D3]"
                      />
                      <span className="capitalize">{roleKey.replace('_', ' ')}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                disabled={savingPolicy}
                onClick={handleSaveVisibilityPolicy}
                className="px-5 py-2.5 bg-[#0176D3] hover:bg-[#014486] text-white font-semibold text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {savingPolicy ? 'Saving Changes...' : 'Save Visibility Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Agency Team Member</h3>
            <p className="text-xs text-slate-500 mb-5">
              Create a login for a new developer, QA lead, support manager, or administrator.
            </p>

            <form onSubmit={handleCreateMember} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  placeholder="e.g. Alex Developer"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  placeholder="alex@agency.com"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  WhatsApp Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={memberForm.password}
                  onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                  placeholder="Password"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Role / Specialization *
                </label>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.label} ({r.is_system ? 'System' : 'Custom'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditMemberModal && editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Team Member</h3>
                <p className="text-xs text-slate-500">Update account details, role permissions, or reset password.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateMember} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editMemberForm.name}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={editMemberForm.email}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, email: e.target.value })}
                  placeholder="name@assurancemedia.in"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  WhatsApp Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={editMemberForm.phone}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, phone: e.target.value })}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Role / Specialization *
                </label>
                <select
                  value={editMemberForm.role}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.label} ({r.is_system ? 'System' : 'Custom'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Reset Password <span className="font-normal text-slate-400 lowercase">(leave blank to keep current)</span>
                </label>
                <input
                  type="text"
                  value={editMemberForm.password}
                  onChange={(e) => setEditMemberForm({ ...editMemberForm, password: e.target.value })}
                  placeholder="New temporary or permanent password"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              {editMemberForm.password.trim() && (
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={editMemberForm.must_reset_password}
                      onChange={(e) => setEditMemberForm({ ...editMemberForm, must_reset_password: e.target.checked })}
                      className="rounded text-[#0176D3] focus:ring-[#0176D3]"
                    />
                    <span>Force user to change password on next login</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={editMemberForm.send_email}
                      onChange={(e) => setEditMemberForm({ ...editMemberForm, send_email: e.target.checked })}
                      className="rounded text-[#0176D3] focus:ring-[#0176D3]"
                    />
                    <span>Send email notification with new login credentials</span>
                  </label>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditMemberModal(false);
                    setEditingMember(null);
                  }}
                  className="px-4 py-2 border rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create Custom Role</h3>
            <p className="text-xs text-slate-500 mb-5">
              Define a new role and title for team members in your agency.
            </p>

            <form onSubmit={handleCreateRole} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Role Identifier Key *
                </label>
                <input
                  type="text"
                  required
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g. qa_engineer"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Display Label *
                </label>
                <input
                  type="text"
                  required
                  value={roleForm.label}
                  onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })}
                  placeholder="e.g. Senior QA Engineer"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="e.g. Validates reproductions and tests staging fixes"
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Base Security Level *
                </label>
                <select
                  value={roleForm.base_role}
                  onChange={(e) => setRoleForm({ ...roleForm, base_role: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                >
                  <option value="developer">Developer (Claim, Fix, Internal Notes)</option>
                  <option value="support_manager">Support Manager (Triage, Assign, Routing)</option>
                  <option value="super_admin">Super Admin (Full Agency Management)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
