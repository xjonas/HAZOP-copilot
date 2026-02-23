'use client';

import React from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { ProjectsProvider } from '@/hooks/useProjects';
import { MeetingsProvider } from '@/hooks/useMeetings';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ProjectsProvider>
                <MeetingsProvider>
                    {children}
                </MeetingsProvider>
            </ProjectsProvider>
        </AuthProvider>
    );
}
