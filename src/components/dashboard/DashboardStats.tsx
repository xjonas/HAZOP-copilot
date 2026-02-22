'use client';

import React, { useMemo } from 'react';
import { FolderKanban, BarChart3, CheckCircle2, Clock } from 'lucide-react';
import type { Project } from '@/types';

interface DashboardStatsProps {
    projects: Project[];
}

export function DashboardStats({ projects }: DashboardStatsProps) {
    const stats = useMemo<{ active: number; total: number; completed: number; nearestDeadline: { date: Date, name: string } | null }>(() => {
        const active = projects.filter(p => p.status === 'active' || p.status === 'planning').length;
        const total = projects.length;
        const completed = projects.filter(p => p.status === 'completed').length;

        let nearestDeadline: { date: Date, name: string } | null = null;
        projects.forEach(p => {
            if (p.deadline && p.status !== 'completed') {
                const date = new Date(p.deadline);
                if (date >= new Date() && (!nearestDeadline || date < nearestDeadline.date)) {
                    nearestDeadline = { date, name: p.name };
                }
            }
        });

        return { active, total, completed, nearestDeadline };
    }, [projects]);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--color-primary-500)' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-100)' }}>
                            <FolderKanban size={24} style={{ color: 'var(--color-primary-600)' }} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold" style={{ color: 'var(--color-slate-900)' }}>{stats.active}</p>
                            <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Active Projects</p>
                        </div>
                    </div>
                </div>

                <div className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--color-accent-500)' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50">
                            <BarChart3 size={24} className="text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold" style={{ color: 'var(--color-slate-900)' }}>{stats.total}</p>
                            <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Total Projects</p>
                        </div>
                    </div>
                </div>

                <div className="card p-6 border-l-4" style={{ borderLeftColor: 'var(--color-success-500)' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f0fdf4' }}>
                            <CheckCircle2 size={24} style={{ color: 'var(--color-success-500)' }} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold" style={{ color: 'var(--color-slate-900)' }}>{stats.completed}</p>
                            <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Completed</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Deadline Alert Banner */}
            {stats.nearestDeadline && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-4 text-orange-800 shadow-sm">
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm">Approaching Deadline</h4>
                        <p className="text-sm text-orange-700/80">
                            {stats.nearestDeadline.name} is due on {stats.nearestDeadline.date.toLocaleDateString()}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
