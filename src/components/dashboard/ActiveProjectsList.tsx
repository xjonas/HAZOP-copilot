'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Activity, User, Calendar, ArrowRight } from 'lucide-react';
import type { Project } from '@/types';

interface ActiveProjectsListProps {
    projects: Project[];
}

export function ActiveProjectsList({ projects }: ActiveProjectsListProps) {
    const router = useRouter();
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning').slice(0, 5);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-slate-800)' }}>Active Projects</h2>
                <button onClick={() => router.push('/projects/new')} className="btn btn-primary text-sm">
                    <Plus size={16} />
                    New Project
                </button>
            </div>

            {activeProjects.length === 0 ? (
                <div className="card p-12 text-center">
                    <FolderKanban size={48} className="mx-auto mb-4" style={{ color: 'var(--color-slate-300)' }} />
                    <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-slate-700)' }}>No projects yet</h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>Create your first HAZOP project to get started.</p>
                    <button onClick={() => router.push('/projects/new')} className="btn btn-primary">
                        <Plus size={16} />
                        Create Project
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeProjects.map((project) => (
                        <Link
                            key={project.id}
                            href={`/projects/${project.id}/dashboard`}
                            className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow group block"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-100)' }}>
                                    <Activity size={20} style={{ color: 'var(--color-primary-600)' }} />
                                </div>
                                <div>
                                    <h3 className="font-medium" style={{ color: 'var(--color-slate-900)' }}>{project.name}</h3>
                                    <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>
                                        {project.description || 'No description'}
                                    </p>
                                    <div className="flex items-center gap-4 mt-1">
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
                            </div>
                            <div className="flex items-center gap-4">
                                {project.progress !== undefined && project.progress > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-2 rounded-full" style={{ backgroundColor: 'var(--color-slate-200)' }}>
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${project.progress}%`,
                                                    backgroundColor: 'var(--color-primary-500)',
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium" style={{ color: 'var(--color-slate-500)' }}>{project.progress}%</span>
                                    </div>
                                )}
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" style={{ color: 'var(--color-slate-400)' }} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
