'use client';

import React, { useState, useCallback, createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { validateUploadFile } from '@/lib/storage/upload-security';
import { useAuth } from '@/hooks/useAuth';
import type { Meeting } from '@/types';

const ALLOWED_MEETING_MIME_TYPES = [
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'video/mp4',
    'video/webm',
];
const MAX_MEETING_FILE_BYTES = 250 * 1024 * 1024;

async function parseApiError(response: Response, fallback: string): Promise<Error> {
    try {
        const payload = await response.json();
        if (payload?.error && typeof payload.error === 'string') {
            return new Error(payload.error);
        }
    } catch {
        // ignore
    }

    return new Error(fallback);
}

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
    const lastUserSubRef = useRef<string | null>(null);

    useEffect(() => {
        const currentSub = user?.sub ?? null;
        if (lastUserSubRef.current === currentSub) {
            return;
        }

        lastUserSubRef.current = currentSub;
        setAllMeetings(null);
    }, [user?.sub]);

    const getAllMeetings = useCallback(async (): Promise<Meeting[]> => {
        if (!user) return [];
        if (allMeetings !== null) return allMeetings;

        const response = await fetch('/api/meetings', { cache: 'no-store' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to fetch meetings');
        }

        const data = await response.json();
        const fetched = (data.meetings || []) as Meeting[];
        setAllMeetings(fetched);
        return fetched;
    }, [allMeetings, user]);

    const getMeetings = useCallback(async (projectId: string): Promise<Meeting[]> => {
        if (allMeetings !== null) {
            return allMeetings.filter((meeting) => meeting.projectId === projectId);
        }

        const response = await fetch(`/api/meetings?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to fetch project meetings');
        }

        const data = await response.json();
        return (data.meetings || []) as Meeting[];
    }, [allMeetings]);

    const addMeeting = useCallback(async (meeting: Partial<Meeting>): Promise<Meeting> => {
        const response = await fetch('/api/meetings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(meeting),
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to create meeting');
        }

        const data = await response.json();
        const created = data.meeting as Meeting;

        if (allMeetings !== null) {
            setAllMeetings((prev) => prev ? [...prev, created] : [created]);
        }

        return created;
    }, [allMeetings]);

    const updateMeeting = useCallback(async (meetingId: string, updates: Partial<Meeting>): Promise<Meeting> => {
        const response = await fetch(`/api/meetings/${meetingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to update meeting');
        }

        const data = await response.json();
        const updated = data.meeting as Meeting;

        if (allMeetings !== null) {
            setAllMeetings((prev) => prev ? prev.map((meeting) => meeting.id === meetingId ? updated : meeting) : null);
        }

        return updated;
    }, [allMeetings]);

    const deleteMeeting = useCallback(async (meetingId: string): Promise<void> => {
        const response = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to delete meeting');
        }

        if (allMeetings !== null) {
            setAllMeetings((prev) => prev ? prev.filter((meeting) => meeting.id !== meetingId) : null);
        }
    }, [allMeetings]);

    const uploadMeetingRecording = useCallback(async (projectId: string, file: File): Promise<string> => {
        validateUploadFile(file, {
            allowedMimeTypes: ALLOWED_MEETING_MIME_TYPES,
            maxBytes: MAX_MEETING_FILE_BYTES,
        });

        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('bucketType', 'meeting');
        formData.append('file', file);

        const response = await fetch('/api/storage/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to upload meeting recording');
        }

        const payload = await response.json();
        return payload.storagePath as string;
    }, []);

    return (
        <MeetingsContext.Provider value={{
            getAllMeetings,
            getMeetings,
            addMeeting,
            updateMeeting,
            deleteMeeting,
            uploadMeetingRecording,
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
