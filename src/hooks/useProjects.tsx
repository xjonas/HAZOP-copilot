'use client';

import React, { useState, useEffect, useContext, createContext, useCallback, ReactNode, useRef } from 'react';
import { validateUploadFile } from '@/lib/supabase/upload-security';
import { useAuth } from '@/hooks/useAuth';
import type { Project, ProjectFile, Task, HazopRow } from '@/types';

const ALLOWED_PROJECT_FILE_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_PROJECT_FILE_BYTES = 50 * 1024 * 1024;

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

interface ProjectsContextType {
    projects: Project[];
    loading: boolean;
    addProject: (project: Partial<Project>) => Promise<Project>;
    getProject: (id: string) => Project | undefined;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    uploadFile: (projectId: string, file: File) => Promise<ProjectFile>;
    getFiles: (projectId: string) => Promise<ProjectFile[]>;
    getSignedUrl: (storagePath: string, bucket?: string) => Promise<string>;
    getTasks: (projectId: string, taskType?: 'object' | 'node', forceRefresh?: boolean) => Promise<Task[]>;
    upsertTasks: (tasks: Partial<Task>[]) => Promise<Task[]>;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    getHazopRows: (nodeTaskId: string) => Promise<HazopRow[]>;
    upsertHazopRows: (rows: Partial<HazopRow>[]) => Promise<HazopRow[]>;
    deleteHazopRow: (rowId: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [allFiles, setAllFiles] = useState<ProjectFile[] | null>(null);
    const [signedUrls, setSignedUrls] = useState<Record<string, { url: string; expiresAt: number }>>({});
    const [allTasks, setAllTasks] = useState<Task[] | null>(null);
    const [allHazopRows, setAllHazopRows] = useState<HazopRow[] | null>(null);

    const lastUserSubRef = useRef<string | null>(null);
    const loadedFileProjectIdsRef = useRef<Set<string>>(new Set());
    const loadedTaskProjectIdsRef = useRef<Set<string>>(new Set());
    const loadedHazopNodeIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const currentSub = user?.sub ?? null;
        if (lastUserSubRef.current === currentSub) {
            return;
        }

        lastUserSubRef.current = currentSub;
        loadedFileProjectIdsRef.current.clear();
        loadedTaskProjectIdsRef.current.clear();
        loadedHazopNodeIdsRef.current.clear();
        setProjects([]);
        setAllFiles(null);
        setSignedUrls({});
        setAllTasks(null);
        setAllHazopRows(null);
        setLoading(true);
    }, [user?.sub]);

    const fetchProjects = useCallback(async () => {
        if (!user) {
            setProjects([]);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/projects', { cache: 'no-store' });
            if (!response.ok) {
                throw await parseApiError(response, 'Failed to fetch projects');
            }
            const data = await response.json();
            setProjects(data.projects || []);
        } catch (err) {
            console.error('fetchProjects error:', err);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const addProject = useCallback(async (project: Partial<Project>): Promise<Project> => {
        if (!user) throw new Error('Not authenticated');

        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project),
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to create project');
        }

        const data = await response.json();
        const created = data.project as Project;
        setProjects(prev => [created, ...prev]);
        return created;
    }, [user]);

    const getProject = useCallback((id: string) => projects.find((project) => project.id === id), [projects]);

    const updateProject = useCallback(async (id: string, updates: Partial<Project>): Promise<void> => {
        const response = await fetch(`/api/projects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to update project');
        }

        setProjects(prev => prev.map((project) => project.id === id ? { ...project, ...updates } : project));
    }, []);

    const deleteProject = useCallback(async (id: string): Promise<void> => {
        const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to delete project');
        }

        setProjects(prev => prev.filter((project) => project.id !== id));
    }, []);

    const uploadFile = useCallback(async (projectId: string, file: File): Promise<ProjectFile> => {
        if (!user) throw new Error('Not authenticated');

        validateUploadFile(file, {
            allowedMimeTypes: ALLOWED_PROJECT_FILE_MIME_TYPES,
            maxBytes: MAX_PROJECT_FILE_BYTES,
        });

        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('bucketType', 'pid');
        formData.append('file', file);

        const uploadResponse = await fetch('/api/storage/upload', {
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            throw await parseApiError(uploadResponse, 'Failed to upload file');
        }

        const uploadResult = await uploadResponse.json();
        const storagePath = uploadResult.storagePath as string;

        const metadataResponse = await fetch(`/api/projects/${projectId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                storagePath,
                mimeType: file.type || 'application/pdf',
                sizeBytes: file.size,
            }),
        });

        if (!metadataResponse.ok) {
            throw await parseApiError(metadataResponse, 'Failed to save file metadata');
        }

        const data = await metadataResponse.json();
        const created = data.file as ProjectFile;

        loadedFileProjectIdsRef.current.add(projectId);
        setAllFiles(prev => prev ? [...prev, created] : [created]);

        return created;
    }, [allFiles, user]);

    const getFiles = useCallback(async (projectId: string): Promise<ProjectFile[]> => {
        const hasLoadedProjectFiles = loadedFileProjectIdsRef.current.has(projectId);
        if (allFiles !== null && hasLoadedProjectFiles) {
            return allFiles.filter((file) => file.projectId === projectId);
        }

        const response = await fetch(`/api/projects/${projectId}/files`, { cache: 'no-store' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to fetch files');
        }

        const data = await response.json();
        const fetched = (data.files || []) as ProjectFile[];
        loadedFileProjectIdsRef.current.add(projectId);
        setAllFiles(prev => prev ? [...prev, ...fetched] : fetched);
        return fetched;
    }, [allFiles]);

    const getSignedUrl = useCallback(async (storagePath: string, bucket: string = 'pid-files'): Promise<string> => {
        const now = Date.now();
        const cacheKey = `${bucket}:${storagePath}`;
        const cached = signedUrls[cacheKey];
        if (cached && cached.expiresAt > now + 300000) {
            return cached.url;
        }

        const projectId = storagePath.split('/')[0];
        if (!projectId) {
            throw new Error('Invalid storage path');
        }

        const bucketType = bucket === 'meeting-recordings' ? 'meeting' : 'pid';
        const query = new URLSearchParams({
            projectId,
            storagePath,
            bucketType,
        });

        const response = await fetch(`/api/storage/signed-url?${query.toString()}`);
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to create signed URL');
        }

        const data = await response.json();
        const signedUrl = data.signedUrl as string;

        setSignedUrls(prev => ({
            ...prev,
            [cacheKey]: {
                url: signedUrl,
                expiresAt: now + 3600 * 1000,
            },
        }));

        return signedUrl;
    }, [signedUrls]);

    const getTasks = useCallback(async (projectId: string, taskType?: 'object' | 'node', forceRefresh: boolean = false): Promise<Task[]> => {
        const hasLoadedProjectTasks = loadedTaskProjectIdsRef.current.has(projectId);
        if (allTasks !== null && !forceRefresh && hasLoadedProjectTasks) {
            const projectTasks = allTasks.filter((task) => task.projectId === projectId);
            if (taskType) {
                return projectTasks
                    .filter((task) => task.taskType === taskType)
                    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            }
            return projectTasks.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        }

        const query = taskType ? `?taskType=${taskType}` : '';
        const response = await fetch(`/api/projects/${projectId}/tasks${query}`, { cache: 'no-store' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to fetch tasks');
        }

        const data = await response.json();
        const fetched = (data.tasks || []) as Task[];

        if (!taskType) {
            loadedTaskProjectIdsRef.current.add(projectId);
            setAllTasks(prev => prev ? [...prev.filter((task) => task.projectId !== projectId), ...fetched] : fetched);
        }

        return fetched;
    }, [allTasks]);

    const upsertTasks = useCallback(async (taskItems: Partial<Task>[]): Promise<Task[]> => {
        if (!taskItems.length) {
            return [];
        }

        const projectId = taskItems[0]?.projectId;
        if (!projectId) {
            throw new Error('Task projectId is required for upsert');
        }

        const response = await fetch(`/api/projects/${projectId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: taskItems }),
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to upsert tasks');
        }

        const data = await response.json();
        const upserted = (data.tasks || []) as Task[];

        if (allTasks !== null) {
            setAllTasks(prev => {
                if (!prev) return upserted;
                const upsertedIds = new Set(upserted.map((task) => task.id));
                const nonUpdated = prev.filter((task) => !upsertedIds.has(task.id));
                return [...nonUpdated, ...upserted];
            });
        }

        loadedTaskProjectIdsRef.current.add(projectId);

        return upserted;
    }, [allTasks]);

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>): Promise<void> => {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to update task');
        }

        if (allTasks !== null) {
            setAllTasks(prev => prev ? prev.map((task) => task.id === taskId ? { ...task, ...updates } : task) : null);
        }
    }, [allTasks]);

    const getHazopRows = useCallback(async (nodeTaskId: string): Promise<HazopRow[]> => {
        const hasLoadedRows = loadedHazopNodeIdsRef.current.has(nodeTaskId);
        if (allHazopRows !== null && hasLoadedRows) {
            return allHazopRows
                .filter((row) => row.nodeTaskId === nodeTaskId)
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        }

        const response = await fetch(`/api/hazop-rows?nodeTaskId=${encodeURIComponent(nodeTaskId)}`, { cache: 'no-store' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to fetch HAZOP rows');
        }

        const data = await response.json();
        const fetched = (data.rows || []) as HazopRow[];
        loadedHazopNodeIdsRef.current.add(nodeTaskId);
        setAllHazopRows(prev => prev ? [...prev.filter((row) => row.nodeTaskId !== nodeTaskId), ...fetched] : fetched);
        return fetched;
    }, [allHazopRows]);

    const upsertHazopRows = useCallback(async (rows: Partial<HazopRow>[]): Promise<HazopRow[]> => {
        const response = await fetch('/api/hazop-rows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows }),
        });

        if (!response.ok) {
            throw await parseApiError(response, 'Failed to upsert HAZOP rows');
        }

        const data = await response.json();
        const upserted = (data.rows || []) as HazopRow[];

        for (const row of upserted) {
            loadedHazopNodeIdsRef.current.add(row.nodeTaskId);
        }

        if (allHazopRows !== null) {
            setAllHazopRows(prev => {
                if (!prev) return upserted;
                const upsertedIds = new Set(upserted.map((row) => row.id));
                const nonUpdated = prev.filter((row) => !upsertedIds.has(row.id));
                return [...nonUpdated, ...upserted];
            });
        }

        return upserted;
    }, [allHazopRows]);

    const deleteHazopRow = useCallback(async (rowId: string): Promise<void> => {
        const response = await fetch(`/api/hazop-rows/${rowId}`, { method: 'DELETE' });
        if (!response.ok) {
            throw await parseApiError(response, 'Failed to delete HAZOP row');
        }

        if (allHazopRows !== null) {
            setAllHazopRows(prev => prev ? prev.filter((row) => row.id !== rowId) : null);
        }
    }, [allHazopRows]);

    return (
        <ProjectsContext.Provider value={{
            projects,
            loading,
            addProject,
            getProject,
            updateProject,
            deleteProject,
            uploadFile,
            getFiles,
            getSignedUrl,
            getTasks,
            upsertTasks,
            updateTask,
            getHazopRows,
            upsertHazopRows,
            deleteHazopRow,
        }}>
            {children}
        </ProjectsContext.Provider>
    );
}

export const useProjects = () => {
    const context = useContext(ProjectsContext);
    if (!context) {
        throw new Error('useProjects must be used within a ProjectsProvider');
    }
    return context;
};
