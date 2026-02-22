'use client';

import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toCamel, mapRows, toSnake } from '@/lib/supabase/mappers';
import type { TeamMember } from '@/types';

const supabase = createClient();

interface TeamContextType {
    getTeamMembers: (projectId: string) => Promise<TeamMember[]>;
    addTeamMember: (projectId: string, name: string, role: string) => Promise<TeamMember>;
    removeTeamMember: (memberId: string) => Promise<void>;
}

const TeamContext = createContext<TeamContextType | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
    const [allMembers, setAllMembers] = useState<TeamMember[] | null>(null);

    const getTeamMembers = useCallback(async (projectId: string): Promise<TeamMember[]> => {
        if (allMembers !== null) return allMembers.filter((m: TeamMember) => m.projectId === projectId);

        const { data, error } = await supabase.from('team_members').select('*').eq('project_id', projectId).order('created_at');
        if (error) throw error;
        const fetched = mapRows<TeamMember>(data || []);
        setAllMembers((prev: TeamMember[] | null) => prev ? [...prev.filter((m: TeamMember) => m.projectId !== projectId), ...fetched] : fetched);
        return fetched;
    }, [allMembers]);

    const addTeamMember = useCallback(async (projectId: string, name: string, role: string): Promise<TeamMember> => {
        const { data, error } = await supabase.from('team_members').insert({ project_id: projectId, name, role }).select().single();
        if (error) throw error;
        const created = toCamel<TeamMember>(data);
        if (allMembers !== null) {
            setAllMembers((prev: TeamMember[] | null) => prev ? [...prev, created] : [created]);
        }
        return created;
    }, [allMembers]);

    const removeTeamMember = useCallback(async (memberId: string): Promise<void> => {
        const { error } = await supabase.from('team_members').delete().eq('id', memberId);
        if (error) throw error;
        if (allMembers !== null) {
            setAllMembers((prev: TeamMember[] | null) => prev ? prev.filter((m: TeamMember) => m.id !== memberId) : null);
        }
    }, [allMembers]);

    return (
        <TeamContext.Provider value={{ getTeamMembers, addTeamMember, removeTeamMember }}>
            {children}
        </TeamContext.Provider>
    );
}

export const useTeam = () => {
    const context = useContext(TeamContext);
    if (!context) {
        throw new Error('useTeam must be used within a TeamProvider');
    }
    return context;
};
