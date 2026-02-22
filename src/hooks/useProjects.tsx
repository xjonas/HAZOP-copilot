'use client';

import React, { useState, useEffect, useContext, createContext, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toCamel, mapRows, toSnake } from '@/lib/supabase/mappers';
import { buildSafeStoragePath, validateUploadFile } from '@/lib/supabase/upload-security';
import { useAuth } from '@/hooks/useAuth';
import { getPrimaryOrgIdForUser } from '@/lib/supabase/org-membership';
import type { Project, ProjectFile, Task, HazopRow } from '@/types';

/* ── helpers ─────────────────────────────────────────────── */
const supabase = createClient();
const ALLOWED_PROJECT_FILE_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_PROJECT_FILE_BYTES = 50 * 1024 * 1024;

/* ── Context type ────────────────────────────────────────── */
interface ProjectsContextType {
    projects: Project[];
    loading: boolean;
    // Project CRUD
    addProject: (project: Partial<Project>) => Promise<Project>;
    getProject: (id: string) => Project | undefined;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    // Files
    uploadFile: (projectId: string, file: File) => Promise<ProjectFile>;
    getFiles: (projectId: string) => Promise<ProjectFile[]>;
    getSignedUrl: (storagePath: string, bucket?: string) => Promise<string>;
    // Tasks
    // Tasks
    getTasks: (projectId: string, taskType?: 'object' | 'node') => Promise<Task[]>;
    upsertTasks: (tasks: Partial<Task>[]) => Promise<Task[]>;
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
    // HAZOP rows
    getHazopRows: (nodeTaskId: string) => Promise<HazopRow[]>;
    upsertHazopRows: (rows: Partial<HazopRow>[]) => Promise<HazopRow[]>;
    deleteHazopRow: (rowId: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

/* ── Provider ────────────────────────────────────────────── */
export function ProjectsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    /* Fetch all projects for the user's org */
    const fetchProjects = useCallback(async () => {
        if (!user) { setProjects([]); setLoading(false); return; }
        try {
            const orgId = await getPrimaryOrgIdForUser(supabase, user.id);
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setProjects(mapRows<Project>(data || []));
        } catch (err) {
            console.error('fetchProjects error:', err);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    /* ── Project CRUD ────────────────────────────────────── */
    const addProject = useCallback(async (project: Partial<Project>): Promise<Project> => {
        if (!user) throw new Error('Not authenticated');
        const orgId = await getPrimaryOrgIdForUser(supabase, user.id);
        const row = toSnake({ ...project, orgId, createdBy: user.id });
        // Remove undefined values
        Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
        const { data, error } = await supabase.from('projects').insert(row).select().single();
        if (error) throw error;
        const created = toCamel<Project>(data);
        setProjects(prev => [created, ...prev]);
        return created;
    }, [user]);

    const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects]);

    const updateProject = useCallback(async (id: string, updates: Partial<Project>): Promise<void> => {
        const row = toSnake(updates as Record<string, unknown>);
        Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
        const { error } = await supabase.from('projects').update(row).eq('id', id);
        if (error) throw error;
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }, []);

    const deleteProject = useCallback(async (id: string): Promise<void> => {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
        setProjects(prev => prev.filter(p => p.id !== id));
    }, []);

    /* ── Files ────────────────────────────────────────────── */
    const [allFiles, setAllFiles] = useState<ProjectFile[] | null>(null);

    const uploadFile = useCallback(async (projectId: string, file: File): Promise<ProjectFile> => {
        validateUploadFile(file, {
            allowedMimeTypes: ALLOWED_PROJECT_FILE_MIME_TYPES,
            maxBytes: MAX_PROJECT_FILE_BYTES,
        });

        const storagePath = buildSafeStoragePath(projectId, file.name);
        const { error: uploadError } = await supabase.storage.from('pid-files').upload(storagePath, file);
        if (uploadError) throw uploadError;
        const row = {
            project_id: projectId,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type || 'application/pdf',
            size_bytes: file.size,
            uploaded_by: user?.id,
        };
        const { data, error } = await supabase.from('project_files').insert(row).select().single();
        if (error) throw error;
        const created = toCamel<ProjectFile>(data);
        if (allFiles !== null) {
            setAllFiles(prev => prev ? [...prev, created] : [created]);
        }
        return created;
    }, [user, allFiles]);

    const getFiles = useCallback(async (projectId: string): Promise<ProjectFile[]> => {
        if (allFiles !== null) return allFiles.filter(f => f.projectId === projectId);

        const { data, error } = await supabase.from('project_files').select('*').eq('project_id', projectId).order('created_at');
        if (error) throw error;
        const fetched = mapRows<ProjectFile>(data || []);
        setAllFiles(prev => prev ? [...prev, ...fetched] : fetched);
        return fetched;
    }, [allFiles]);

    const [signedUrls, setSignedUrls] = useState<Record<string, { url: string, expiresAt: number }>>({});

    const getSignedUrl = useCallback(async (storagePath: string, bucket: string = 'pid-files'): Promise<string> => {
        const now = Date.now();
        const cached = signedUrls[storagePath];
        if (cached && cached.expiresAt > now + 300000) {
            return cached.url;
        }

        const expiresIn = 3600;
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
        if (error) throw error;

        setSignedUrls(prev => ({
            ...prev,
            [storagePath]: {
                url: data.signedUrl,
                expiresAt: now + (expiresIn * 1000)
            }
        }));

        return data.signedUrl;
    }, [signedUrls]);

    /* ── Tasks ────────────────────────────────────────────── */
    const [allTasks, setAllTasks] = useState<Task[] | null>(null);

    const getTasks = useCallback(async (projectId: string, taskType?: 'object' | 'node'): Promise<Task[]> => {
        if (allTasks !== null) {
            const projectTasks = allTasks.filter(t => t.projectId === projectId);
            if (taskType) return projectTasks.filter(t => t.taskType === taskType).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            return projectTasks.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        }

        let query = supabase.from('tasks').select('*').eq('project_id', projectId).order('display_order');
        if (taskType) query = query.eq('task_type', taskType);
        const { data, error } = await query;
        if (error) throw error;
        const fetched = mapRows<Task>(data || []);

        // Only safely update cache if we fetched ALL tasks for the project (not just a specific type), 
        // otherwise we might pollute the cache assuming it's fully loaded when it isn't.
        if (!taskType) {
            setAllTasks(prev => prev ? [...prev.filter(t => t.projectId !== projectId), ...fetched] : fetched);
        }

        return fetched;
    }, [allTasks]);

    const upsertTasks = useCallback(async (tasks: Partial<Task>[]): Promise<Task[]> => {
        const rows = tasks.map(t => {
            const row = toSnake(t as Record<string, unknown>);
            Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
            return row;
        });
        const { data, error } = await supabase.from('tasks').upsert(rows).select();
        if (error) throw error;
        const upserted = mapRows<Task>(data || []);

        if (allTasks !== null) {
            setAllTasks(prev => {
                if (!prev) return upserted;
                const upsertedIds = new Set(upserted.map(u => u.id));
                const nonUpdated = prev.filter(t => !upsertedIds.has(t.id));
                return [...nonUpdated, ...upserted];
            });
        }
        return upserted;
    }, [allTasks]);

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>): Promise<void> => {
        const row = toSnake(updates as Record<string, unknown>);
        Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
        const { error } = await supabase.from('tasks').update(row).eq('id', taskId);
        if (error) throw error;
        if (allTasks !== null) {
            setAllTasks(prev => prev ? prev.map(t => t.id === taskId ? { ...t, ...updates } : t) : null);
        }
    }, [allTasks]);

    /* ── HAZOP Rows ──────────────────────────────────────── */
    const [allHazopRows, setAllHazopRows] = useState<HazopRow[] | null>(null);

    const getHazopRows = useCallback(async (nodeTaskId: string): Promise<HazopRow[]> => {
        if (allHazopRows !== null) {
            return allHazopRows.filter(r => r.nodeTaskId === nodeTaskId).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        }

        const { data, error } = await supabase.from('hazop_rows').select('*').eq('node_task_id', nodeTaskId).order('display_order');
        if (error) throw error;
        const fetched = mapRows<HazopRow>(data || []);
        setAllHazopRows(prev => prev ? [...prev.filter(r => r.nodeTaskId !== nodeTaskId), ...fetched] : fetched);
        return fetched;
    }, [allHazopRows]);

    const upsertHazopRows = useCallback(async (rows: Partial<HazopRow>[]): Promise<HazopRow[]> => {
        const dbRows = rows.map(r => {
            const row = toSnake(r as Record<string, unknown>);
            Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
            return row;
        });
        const { data, error } = await supabase.from('hazop_rows').upsert(dbRows).select();
        if (error) throw error;
        const upserted = mapRows<HazopRow>(data || []);

        if (allHazopRows !== null) {
            setAllHazopRows(prev => {
                if (!prev) return upserted;
                const upsertedIds = new Set(upserted.map(u => u.id));
                const nonUpdated = prev.filter(r => !upsertedIds.has(r.id));
                return [...nonUpdated, ...upserted];
            });
        }
        return upserted;
    }, [allHazopRows]);

    const deleteHazopRow = useCallback(async (rowId: string): Promise<void> => {
        const { error } = await supabase.from('hazop_rows').delete().eq('id', rowId);
        if (error) throw error;
        if (allHazopRows !== null) {
            setAllHazopRows(prev => prev ? prev.filter(r => r.id !== rowId) : null);
        }
    }, [allHazopRows]);

    return (
        <ProjectsContext.Provider value={{
            projects, loading,
            addProject, getProject, updateProject, deleteProject,
            uploadFile, getFiles, getSignedUrl,
            getTasks, upsertTasks, updateTask,
            getHazopRows, upsertHazopRows, deleteHazopRow,
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
