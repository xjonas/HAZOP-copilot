'use client';

import React from 'react';
import { useProjects } from '@/hooks/useProjects';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ActiveProjectsList } from '@/components/dashboard/ActiveProjectsList';
import { MeetingPlanner } from '@/components/dashboard/MeetingPlanner';

export default function Dashboard() {
    const { projects, loading } = useProjects();

    if (loading) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Loading...</div>;
    }

    return (
        <div className="space-y-8">
            <DashboardStats projects={projects} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ActiveProjectsList projects={projects} />
                <MeetingPlanner projects={projects} />
            </div>
        </div>
    );
}
