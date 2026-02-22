'use client';

import React, { useState, useEffect } from 'react';
import { use } from 'react';
import {
    Plus,
    Trash2,
    User,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import type { TeamMember } from '@/types';

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { getProject, loading } = useProjects();
    const { getTeamMembers, addTeamMember, removeTeamMember } = useTeam();
    const project = getProject(id);

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [dataLoaded, setDataLoaded] = useState(false);
    const { orgMembers } = useOrgMembers();

    useEffect(() => {
        if (!project || dataLoaded) return;
        const load = async () => {
            try {
                const tm = await getTeamMembers(id);
                setMembers(tm);
                setNewName('');
                setDataLoaded(true);
            } catch (err) {
                console.error('Error loading team members:', err);
                setDataLoaded(true);
            }
        };
        load();
    }, [project, id, dataLoaded, getTeamMembers]);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        try {
            const member = await addTeamMember(id, newName.trim(), newRole.trim() || 'Member');
            setMembers(prev => [...prev, member]);
            setNewName('');
            setNewRole('');
        } catch (err) {
            console.error('Error adding team member:', err);
        }
    };

    const handleRemove = async (memberId: string) => {
        try {
            await removeTeamMember(memberId);
            setMembers(prev => prev.filter(m => m.id !== memberId));
        } catch (err) {
            console.error('Error removing team member:', err);
        }
    };

    if (loading) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Loading...</div>;
    }
    if (!project) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Project not found.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>Team Members</h1>

            {/* Add member */}
            <div className="card p-6">
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-slate-700)' }}>Add Team Member</h2>
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-slate-600)' }}>Name</label>
                        <select
                            className="input"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                        >
                            <option value="">Select a team member...</option>
                            {orgMembers.map((member, i) => (
                                <option key={member.id || i} value={member.full_name}>
                                    {member.full_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-slate-600)' }}>Role</label>
                        <input className="input" value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="e.g., Process Engineer" />
                    </div>
                    <button onClick={handleAdd} className="btn btn-primary" disabled={!newName.trim()}>
                        <Plus size={16} />
                        Add
                    </button>
                </div>
            </div>

            {/* Member list */}
            <div className="space-y-2">
                {members.length === 0 ? (
                    <div className="card p-8 text-center">
                        <User size={32} className="mx-auto mb-3" style={{ color: 'var(--color-slate-300)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>No team members yet.</p>
                    </div>
                ) : (
                    members.map(member => (
                        <div key={member.id} className="card p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: 'var(--color-primary-100)', color: 'var(--color-primary-600)' }}>
                                    {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium" style={{ color: 'var(--color-slate-800)' }}>{member.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-slate-500)' }}>{member.role}</p>
                                </div>
                            </div>
                            <button onClick={() => handleRemove(member.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
