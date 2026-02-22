'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Search,
    MoreVertical,
    Trash2,
    FolderKanban,
    Calendar,
    User,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';

const statusColors: Record<string, string> = {
    planning: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    review: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-gray-100 text-gray-700',
};

export default function ProjectsPage() {
    const router = useRouter();
    const { projects, deleteProject, loading } = useProjects();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [projects, searchQuery, statusFilter]);

    if (loading) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-slate-400)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input"
                            style={{ paddingLeft: '2.5rem' }}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="input"
                        style={{ width: 'auto' }}
                    >
                        <option value="all">All Status</option>
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="review">Review</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <button onClick={() => router.push('/projects/new')} className="btn btn-primary">
                    <Plus size={16} />
                    New Project
                </button>
            </div>

            {/* Project list */}
            {filteredProjects.length === 0 ? (
                <div className="card p-12 text-center">
                    <FolderKanban size={48} className="mx-auto mb-4" style={{ color: 'var(--color-slate-300)' }} />
                    <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-slate-700)' }}>
                        {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
                    </h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                        {projects.length === 0 ? 'Create your first HAZOP project to get started.' : 'Try adjusting your search or filter.'}
                    </p>
                    {projects.length === 0 && (
                        <button onClick={() => router.push('/projects/new')} className="btn btn-primary">
                            <Plus size={16} />
                            Create Project
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredProjects.map((project) => (
                        <div key={project.id} className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow">
                            <Link href={`/projects/${project.id}/dashboard`} className="flex-1 flex items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-medium" style={{ color: 'var(--color-slate-900)' }}>{project.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[project.status ?? ''] || 'bg-gray-100 text-gray-700'}`}>
                                            {project.status}
                                        </span>
                                        {project.workflowStage && project.workflowStage !== project.status && (
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--color-primary-100)', color: 'var(--color-primary-700)' }}>
                                                {project.workflowStage}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm mt-1" style={{ color: 'var(--color-slate-500)' }}>
                                        {project.description || 'No description'}
                                    </p>
                                    <div className="flex items-center gap-4 mt-1.5">
                                        {project.responsiblePerson && (
                                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-slate-400)' }}>
                                                <User size={12} /> {project.responsiblePerson}
                                            </span>
                                        )}
                                        {project.deadline && (
                                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-slate-400)' }}>
                                                <Calendar size={12} /> {new Date(project.deadline).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                            <div className="relative">
                                <button
                                    onClick={() => setOpenMenu(openMenu === project.id ? null : project.id)}
                                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <MoreVertical size={18} style={{ color: 'var(--color-slate-400)' }} />
                                </button>
                                {openMenu === project.id && (
                                    <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border py-1 z-10 w-40" style={{ borderColor: 'var(--color-slate-200)' }}>
                                        <button
                                            onClick={async () => { await deleteProject(project.id); setOpenMenu(null); }}
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
