'use client';

import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toCamel, mapRows, toSnake } from '@/lib/supabase/mappers';
import { buildSafeStoragePath, validateUploadFile } from '@/lib/supabase/upload-security';
import { useAuth } from '@/hooks/useAuth';
import { getPrimaryOrgIdForUser } from '@/lib/supabase/org-membership';
import type { Meeting } from '@/types';

const supabase = createClient();
const ALLOWED_MEETING_MIME_TYPES = [
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'video/mp4',
    'video/webm',
];
const MAX_MEETING_FILE_BYTES = 250 * 1024 * 1024;

interface MeetingsContextType {
    getAllMeetings: () => Promise<Meeting[]>;
    getMeetings: (projectId: string) => Promise<Meeting[]>;
    addMeeting: (meeting: Partial<Meeting>) => Promise<Meeting>;
    updateMeeting: (meetingId: string, updates: Partial<Meeting>) => Promise<Meeting>;
    deleteMeeting: (meetingId: string) => Promise<void>;
    uploadMeetingRecording: (projectId: string, file: File) => Promise<string>;
}

const MeetingsContext = createContext<MeetingsContextType | null>(null);

export function MeetingsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    const [allMeetings, setAllMeetings] = useState<Meeting[] | null>(null);

    const getAllMeetings = useCallback(async (): Promise<Meeting[]> => {
        if (!user) return [];
        if (allMeetings !== null) return allMeetings; // Cache hit

        const orgId = await getPrimaryOrgIdForUser(supabase, user.id);
        const { data: orgProjects, error: orgProjErr } = await supabase
            .from('projects')
            .select('id')
            .eq('org_id', orgId);

        if (orgProjErr || !orgProjects) return [];

        const projectIds = orgProjects.map(p => p.id);
        if (projectIds.length === 0) return [];

        const { data, error } = await supabase
            .from('meetings')
            .select('*')
            .in('project_id', projectIds)
            .order('date', { ascending: true }); // ASC for upcoming

        if (error) throw error;
        const fetched = mapRows<Meeting>(data || []);
        setAllMeetings(fetched);
        return fetched;
    }, [user, allMeetings]);

    const getMeetings = useCallback(async (projectId: string): Promise<Meeting[]> => {
        // We can just filter the cache if it exists
        if (allMeetings !== null) return allMeetings.filter((m: Meeting) => m.projectId === projectId);

        const { data, error } = await supabase.from('meetings').select('*').eq('project_id', projectId).order('date', { ascending: false });
        if (error) throw error;
        return mapRows<Meeting>(data || []);
    }, [allMeetings]);

    const addMeeting = useCallback(async (meeting: Partial<Meeting>): Promise<Meeting> => {
        const row = toSnake(meeting as Record<string, unknown>);
        Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
        const { data, error } = await supabase.from('meetings').insert(row).select().single();
        if (error) throw error;
        const created = toCamel<Meeting>(data);
        if (allMeetings !== null) {
            setAllMeetings((prev: Meeting[] | null) => prev ? [...prev, created] : [created]);
        }
        return created;
    }, [allMeetings]);

    const updateMeeting = useCallback(async (meetingId: string, updates: Partial<Meeting>): Promise<Meeting> => {
        const row = toSnake(updates as Record<string, unknown>);
        Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
        const { data, error } = await supabase.from('meetings').update(row).eq('id', meetingId).select().single();
        if (error) throw error;
        const updated = toCamel<Meeting>(data);
        if (allMeetings !== null) {
            setAllMeetings((prev: Meeting[] | null) => prev ? prev.map((m: Meeting) => m.id === meetingId ? updated : m) : null);
        }
        return updated;
    }, [allMeetings]);

    const deleteMeeting = useCallback(async (meetingId: string): Promise<void> => {
        // Fetch the meeting first to get the path
        const { data: meetingData, error: fetchError } = await supabase.from('meetings').select('recording_path').eq('id', meetingId).single();
        if (!fetchError && meetingData?.recording_path) {
            await supabase.storage.from('meeting-recordings').remove([meetingData.recording_path]);
        }

        const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
        if (error) throw error;
        if (allMeetings !== null) {
            setAllMeetings((prev: Meeting[] | null) => prev ? prev.filter((m: Meeting) => m.id !== meetingId) : null);
        }
    }, [allMeetings]);

    const uploadMeetingRecording = useCallback(async (projectId: string, file: File): Promise<string> => {
        validateUploadFile(file, {
            allowedMimeTypes: ALLOWED_MEETING_MIME_TYPES,
            maxBytes: MAX_MEETING_FILE_BYTES,
        });

        const storagePath = buildSafeStoragePath(projectId, file.name);
        const { error: uploadError } = await supabase.storage.from('meeting-recordings').upload(storagePath, file);
        if (uploadError) throw uploadError;
        return storagePath;
    }, []);

    return (
        <MeetingsContext.Provider value={{
            getAllMeetings, getMeetings, addMeeting, updateMeeting, deleteMeeting, uploadMeetingRecording,
        }}>
            {children}
        </MeetingsContext.Provider>
    );
}

export const useMeetings = () => {
    const context = useContext(MeetingsContext);
    if (!context) {
        throw new Error('useMeetings must be used within a MeetingsProvider');
    }
    return context;
};
