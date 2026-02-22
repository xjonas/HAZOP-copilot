'use client';

import React from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { ProjectsProvider } from '@/hooks/useProjects';
import { MeetingsProvider } from '@/hooks/useMeetings';
import { TeamProvider } from '@/hooks/useTeam';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ProjectsProvider>
                <MeetingsProvider>
                    <TeamProvider>{children}</TeamProvider>
                </MeetingsProvider>
            </ProjectsProvider>
        </AuthProvider>
    );
}
