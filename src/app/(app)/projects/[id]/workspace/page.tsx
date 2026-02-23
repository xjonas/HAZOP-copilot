'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
    Play,
    Check,
    X,
    Eye,
    FileText,
    Box,
    GitBranch,
    PanelRightOpen,
    PanelRightClose,
    Maximize2,
    Minimize2,
    Plus,
    Pencil,
    RotateCcw,
    AlertCircle,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import type { Task, PdfFile } from '@/types';
import dynamic from 'next/dynamic';
import TaskCard from '@/components/TaskCard';

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false });
import type { NodeOverlay } from '@/components/PdfViewer';

type WorkflowStage = 'upload' | 'objectDetection' | 'objectReview' | 'nodeDetection' | 'nodeReview' | 'completed';
type ViewerTab = 'pid' | 'objects' | 'nodes';
type ReviewTab = 'pending' | 'approved';
type PanelSize = 'collapsed' | 'normal' | 'expanded';

const WORKFLOW_STEPS: { key: WorkflowStage; label: string; short: string }[] = [
    { key: 'upload', label: 'Upload P&ID', short: 'Upload' },
    { key: 'objectDetection', label: 'Object Detection', short: 'Detect' },
    { key: 'objectReview', label: 'Object Review', short: 'Review' },
    { key: 'nodeDetection', label: 'Node Detection', short: 'Nodes' },
    { key: 'nodeReview', label: 'Node Review', short: 'Verify' },
    { key: 'completed', label: 'Complete', short: 'Done' },
];

function getStepIndex(stage: WorkflowStage): number {
    return WORKFLOW_STEPS.findIndex(s => s.key === stage);
}

/* ─── Step Bubble Progress ──────────────────────────── */
function StepBubbles({ currentStage, highestStage, onStepClick }: {
    currentStage: WorkflowStage;
    highestStage: WorkflowStage;
    onStepClick?: (stage: WorkflowStage) => void;
}) {
    const currentIdx = getStepIndex(currentStage);
    const highestIdx = getStepIndex(highestStage);

    return (
        <div className="flex items-center w-full px-2">
            {WORKFLOW_STEPS.map((step, i) => {
                const isCompleted = i < currentIdx;
                const isCurrent = i === currentIdx;
                const isReachable = i <= highestIdx && !isCurrent;
                const isFuture = i > highestIdx;

                const canClick = isReachable && onStepClick;

                return (
                    <React.Fragment key={step.key}>
                        {/* Connector line */}
                        {i > 0 && (
                            <div className="flex-1 h-0.5 mx-1 rounded-full transition-all duration-500" style={{
                                backgroundColor: i <= highestIdx ? 'var(--color-success-500)' : 'var(--color-slate-200)',
                            }} />
                        )}
                        {/* Bubble */}
                        <div
                            className={`flex flex-col items-center gap-1 relative group ${canClick ? 'cursor-pointer' : ''}`}
                            style={{ minWidth: 40 }}
                            onClick={() => canClick && onStepClick(step.key)}
                            title={canClick ? `Go to ${step.label}` : undefined}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isCompleted || (i <= highestIdx && !isCurrent)
                                    ? 'bg-green-500 text-white shadow-md'
                                    : isCurrent
                                        ? 'text-white shadow-lg'
                                        : 'border-2 text-slate-400'
                                    } ${canClick ? 'hover:ring-2 hover:ring-primary-300 hover:scale-110' : ''}`}
                                style={{
                                    ...(isCurrent ? {
                                        backgroundColor: 'var(--color-primary-500)',
                                        boxShadow: '0 0 0 4px rgba(99,102,241,0.2)',
                                        animation: 'pulse 2s infinite',
                                    } : {}),
                                    ...(isFuture ? { borderColor: 'var(--color-slate-300)', backgroundColor: 'white' } : {}),
                                }}
                            >
                                {(isCompleted || (i <= highestIdx && !isCurrent)) ? <Check size={14} /> : i + 1}
                            </div>
                            <span className={`text-[10px] leading-tight text-center whitespace-nowrap ${isCompleted ? 'text-green-600 font-medium' : isCurrent ? 'font-semibold' : ''
                                }`} style={{
                                    color: isCurrent ? 'var(--color-primary-600)' : isFuture ? 'var(--color-slate-400)' : undefined,
                                }}>
                                {step.short}
                            </span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}



/* ─── Inline Add Form ───────────────────────────────── */
/* ─── Inline Add Form ───────────────────────────────── */
function AddTaskForm({ taskType, onAdd, onCancel }: {
    taskType: 'object' | 'node';
    onAdd: (title: string, description: string, extra?: { position?: string, chemicals?: string, operatingConditions?: string, connections?: string, designIntent?: string, boundaries?: string, equipmentTags?: string, objects?: string }) => void;
    onCancel: () => void;
}) {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [position, setPosition] = useState('');
    const [chemicals, setChemicals] = useState('');
    const [operatingConditions, setOps] = useState('');
    const [connections, setConnections] = useState('');
    // Node fields
    const [designIntent, setDesignIntent] = useState('');
    const [boundaries, setBoundaries] = useState('');
    const [equipmentTags, setEquipmentTags] = useState('');
    const [objects, setObjects] = useState('');

    return (
        <div className="p-3 rounded-lg border-2 border-dashed space-y-3" style={{ borderColor: 'var(--color-primary-300)', backgroundColor: 'var(--color-primary-50)' }}>
            <div className="space-y-2">
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Title</label>
                    <input
                        className="input text-sm w-full"
                        placeholder={`${taskType === 'object' ? 'Object' : 'Node'} name`}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        autoFocus
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                    <input
                        className="input text-sm w-full"
                        placeholder="Description (optional)"
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                    />
                </div>

                {/* Structured Fields for Objects */}
                {taskType === 'object' && (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Position</label>
                            <input
                                className="input text-xs w-full"
                                placeholder="Relative location..."
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Chemicals</label>
                            <input
                                className="input text-xs w-full"
                                placeholder="Chemicals involved..."
                                value={chemicals}
                                onChange={(e) => setChemicals(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Conditions</label>
                            <input
                                className="input text-xs w-full"
                                placeholder="Temp, pressure..."
                                value={operatingConditions}
                                onChange={(e) => setOps(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Connections</label>
                            <input
                                className="input text-xs w-full"
                                placeholder="Inlet/outlet..."
                                value={connections}
                                onChange={(e) => setConnections(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Structured Fields for Nodes */}
                {taskType === 'node' && (
                    <div className="space-y-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Design Intent</label>
                            <textarea
                                className="input text-xs w-full"
                                rows={2}
                                placeholder="Purpose of this node..."
                                value={designIntent}
                                onChange={(e) => setDesignIntent(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Boundaries</label>
                            <textarea
                                className="input text-xs w-full"
                                rows={2}
                                placeholder="From... to..."
                                value={boundaries}
                                onChange={(e) => setBoundaries(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Chemicals</label>
                                <input
                                    className="input text-xs w-full"
                                    placeholder="Chemicals involved..."
                                    value={chemicals}
                                    onChange={(e) => setChemicals(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Objects</label>
                                <input
                                    className="input text-xs w-full"
                                    placeholder="R-101, P-102..."
                                    value={objects}
                                    onChange={(e) => setObjects(e.target.value)}
                                />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Equipment / Ops</label>
                                <input
                                    className="input text-xs w-full"
                                    placeholder="Reactors, pumps..."
                                    value={equipmentTags}
                                    onChange={(e) => setEquipmentTags(e.target.value)}
                                />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Conditions</label>
                                <input
                                    className="input text-xs w-full"
                                    placeholder="Aggregated conditions..."
                                    value={operatingConditions}
                                    onChange={(e) => setOps(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 justify-end">
                <button onClick={onCancel} className="btn btn-secondary text-xs py-1.5 px-3">Cancel</button>
                <button
                    onClick={() => {
                        if (title.trim()) {
                            onAdd(title.trim(), desc.trim(), {
                                position,
                                chemicals,
                                operatingConditions,
                                connections,
                                designIntent,
                                boundaries,
                                equipmentTags,
                                objects,
                            });
                        }
                    }}
                    disabled={!title.trim()}
                    className="btn btn-primary text-xs py-1.5 px-3"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────── */
export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { getProject, updateProject, getTasks, upsertTasks, updateTask, getFiles, getSignedUrl, loading } = useProjects();
    const project = getProject(id);

    const [workflowStage, setWorkflowStageState] = useState<WorkflowStage>('upload');
    const [highestStage, setHighestStage] = useState<WorkflowStage>('upload');
    const [objectTasks, setObjectTasks] = useState<Task[]>([]);
    const [nodeTasks, setNodeTasks] = useState<Task[]>([]);
    const [progress, setProgress] = useState(0);
    const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);
    const signedUrlCache = useRef<Map<string, string>>(new Map());

    // UI state
    const [viewerTab, setViewerTab] = useState<ViewerTab>('pid');
    const [reviewTab, setReviewTab] = useState<ReviewTab>('pending');
    const [panelSize, setPanelSize] = useState<PanelSize>('normal');
    const [showAddObject, setShowAddObject] = useState(false);
    const [showAddNode, setShowAddNode] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectionError, setDetectionError] = useState<string | null>(null);

    // Load project data from Supabase
    useEffect(() => {
        if (!project || dataLoaded) return;
        const loadData = async () => {
            try {
                const allTasks = await getTasks(id);
                const loadedObjectTasks = allTasks.filter(t => t.taskType === 'object');
                const loadedNodeTasks = allTasks.filter(t => t.taskType === 'node');

                setObjectTasks(loadedObjectTasks);
                setNodeTasks(loadedNodeTasks);

                const files = await getFiles(id);
                const pdfFileList: PdfFile[] = [];
                for (const f of files) {
                    const url = await getSignedUrl(f.storagePath);
                    pdfFileList.push({ name: f.fileName, url });
                }
                setPdfFiles(pdfFileList);

                // Restore workflow stage
                const restoredStage = (project.workflowStage as WorkflowStage) || 'upload';
                setWorkflowStageState(restoredStage);

                // Compute the actual highest stage ever reached based on data presence
                // This recovers situations where the workflowStage was overwritten by backward navigation
                let computedHighest: WorkflowStage = restoredStage;
                if (loadedNodeTasks.length > 0 && loadedNodeTasks.every(t => t.status !== 'pending')) {
                    computedHighest = 'completed';
                } else if (loadedNodeTasks.length > 0) {
                    computedHighest = 'nodeReview';
                } else if (loadedObjectTasks.length > 0 && loadedObjectTasks.every(t => t.status !== 'pending')) {
                    computedHighest = 'nodeDetection';
                } else if (loadedObjectTasks.length > 0) {
                    computedHighest = 'objectReview';
                }

                // Keep the highest of what the project says vs what the data actually shows
                if (getStepIndex(computedHighest) > getStepIndex(restoredStage)) {
                    setHighestStage(computedHighest);
                } else {
                    setHighestStage(restoredStage);
                }

                setProgress(project.progress || 0);
                setDataLoaded(true);
            } catch (err) {
                console.error('Error loading workspace data:', err);
                setDataLoaded(true);
            }
        };
        loadData();
    }, [project, id, dataLoaded, getTasks, getFiles, getSignedUrl]);

    // Advance workflow stage (and track highest)
    const setWorkflowStage = async (stage: WorkflowStage) => {
        setWorkflowStageState(stage);
        if (getStepIndex(stage) > getStepIndex(highestStage)) {
            setHighestStage(stage);
        }
        const newProgress = stage === 'upload' ? 0
            : stage === 'objectDetection' ? 20
                : stage === 'objectReview' ? 40
                    : stage === 'nodeDetection' ? 60
                        : stage === 'nodeReview' ? 80
                            : 100;
        setProgress(newProgress);
        const status = stage === 'completed' ? 'active' : (project?.status || 'planning');
        await updateProject(id, { workflowStage: stage, progress: newProgress, status });
    };

    // Navigate to a stage (backward navigation via step bubbles)
    const navigateToStage = (stage: WorkflowStage) => {
        const idx = getStepIndex(stage);
        // Set the stage without updating highest (it stays at whatever was reached)
        setWorkflowStageState(stage);
        // Sync viewer tab
        if (idx <= getStepIndex('objectReview')) {
            setViewerTab(idx >= getStepIndex('objectReview') ? 'objects' : 'pid');
        } else {
            setViewerTab('nodes');
        }
        setReviewTab('pending');

        // Removed updating the database here. We don't want to overwrite the project's actual progressed stage
        // just because the user wanted to look back at a previous step.
    };

    // Real AI-powered object detection via Dedalus API
    const runObjectDetection = useCallback(async () => {
        setIsDetecting(true);
        setDetectionError(null);
        setWorkflowStage('objectDetection');

        try {
            const response = await fetch('/api/ai/detect-objects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ project_id: id }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Detection failed (${response.status})`);
            }

            // Refetch tasks from Supabase to get the newly created object tasks
            const allTasks = await getTasks(id, undefined, true);
            setObjectTasks(allTasks.filter(t => t.taskType === 'object'));

            // Advance to object review
            setWorkflowStageState('objectReview');
            setHighestStage(prev => getStepIndex('objectReview') > getStepIndex(prev) ? 'objectReview' : prev);
            setProgress(40);
            setViewerTab('objects');
            setReviewTab('pending');
            await updateProject(id, { workflowStage: 'objectReview', progress: 40 });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Object detection failed';
            console.error('Object detection error:', err);
            setDetectionError(message);
        } finally {
            setIsDetecting(false);
        }
    }, [id, getTasks, setWorkflowStage, updateProject]);

    const runNodeDetection = useCallback(async () => {
        setIsDetecting(true);
        setDetectionError(null);
        setWorkflowStage('nodeDetection');

        try {
            const response = await fetch('/api/ai/detect-nodes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ project_id: id }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Node detection failed (${response.status})`);
            }

            // Refetch tasks
            const allTasks = await getTasks(id, undefined, true);
            setNodeTasks(allTasks.filter(t => t.taskType === 'node'));

            setWorkflowStageState('nodeReview');
            setHighestStage(prev => getStepIndex('nodeReview') > getStepIndex(prev) ? 'nodeReview' : prev);
            setProgress(60);
            setViewerTab('nodes');
            setReviewTab('pending');
            await updateProject(id, { workflowStage: 'nodeReview', progress: 60 });

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Node detection failed';
            console.error('Node detection error:', err);
            setDetectionError(message);
        } finally {
            setIsDetecting(false);
        }
    }, [id, getTasks, setWorkflowStage, updateProject]);

    // Smart continue: skip detection if tasks already exist
    const handleContinueToNodes = () => {
        if (nodeTasks.length > 0) {
            // Nodes already exist — skip directly to review
            setWorkflowStageState('nodeReview');
            setHighestStage(prev => getStepIndex('nodeReview') > getStepIndex(prev) ? 'nodeReview' : prev);
            setViewerTab('nodes');
            setReviewTab('pending');
            setProgress(60);
            updateProject(id, { workflowStage: 'nodeReview', progress: 60 });
        } else {
            runNodeDetection();
        }
    };

    const handleStartDetection = () => {
        if (objectTasks.length > 0) {
            // Objects already exist — skip directly to review
            setWorkflowStageState('objectReview');
            setHighestStage(prev => getStepIndex('objectReview') > getStepIndex(prev) ? 'objectReview' : prev);
            setViewerTab('objects');
            setReviewTab('pending');
            setProgress(40);
            updateProject(id, { workflowStage: 'objectReview', progress: 40 });
        } else {
            runObjectDetection();
        }
    };

    const handleTaskAction = async (taskType: 'object' | 'node', taskId: string, action: 'approved' | 'rejected') => {
        try {
            await updateTask(taskId, { status: action });
            if (taskType === 'object') {
                setObjectTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: action } : t));
            } else {
                setNodeTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: action } : t));
            }
        } catch (err) {
            console.error('Error updating task:', err);
        }
    };

    // Edit approved/rejected item → back to pending
    const handleEditTask = async (taskType: 'object' | 'node', taskId: string) => {
        try {
            await updateTask(taskId, { status: 'pending' });
            if (taskType === 'object') {
                setObjectTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending' } : t));
            } else {
                setNodeTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending' } : t));
            }
            setReviewTab('pending');
        } catch (err) {
            console.error('Error resetting task:', err);
        }
    };

    // Delete task (from pending)
    const handleDeleteTask = async (taskType: 'object' | 'node', taskId: string) => {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete task');
            }

            if (taskType === 'object') {
                setObjectTasks(prev => prev.filter(t => t.id !== taskId));
            } else {
                setNodeTasks(prev => prev.filter(t => t.id !== taskId));
            }
        } catch (err) {
            console.error('Error deleting task:', err);
            alert('Failed to delete task. Please try again.');
        }
    };

    // Add manual object or node
    const handleAddManualTask = async (
        taskType: 'object' | 'node',
        title: string,
        description: string,
        extra?: { position?: string, chemicals?: string, operatingConditions?: string, connections?: string, designIntent?: string, boundaries?: string, equipmentTags?: string, drawings?: string, objects?: string }
    ) => {
        try {
            const newTask: Partial<Task> = {
                projectId: id,
                taskType,
                title,
                description,
                status: 'pending',
                displayOrder: taskType === 'object' ? objectTasks.length : nodeTasks.length,
                ...extra
            };
            const created = await upsertTasks([newTask]);
            if (taskType === 'object') {
                setObjectTasks(prev => [...prev, ...created]);
                setShowAddObject(false);
            } else {
                setNodeTasks(prev => [...prev, ...created]);
                setShowAddNode(false);
            }
            setReviewTab('pending');
        } catch (err) {
            console.error('Error adding task:', err);
        }
    };

    // Save edited task details (structured data)
    const handleSaveTask = async (taskId: string, updates: Partial<Task>) => {
        try {
            await updateTask(taskId, updates);
            // Update local state
            setObjectTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
            setNodeTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
        } catch (err) {
            console.error('Error saving task:', err);
            throw err;
        }
    };

    const allObjectsReviewed = objectTasks.length > 0 && objectTasks.every(t => t.status !== 'pending');
    const allNodesReviewed = nodeTasks.length > 0 && nodeTasks.every(t => t.status !== 'pending');
    const confirmedNodes = nodeTasks.filter(t => t.status === 'approved');

    // Split tasks into pending / approved
    const pendingObjects = objectTasks.filter(t => t.status === 'pending');
    const approvedObjects = objectTasks.filter(t => t.status === 'approved');
    const rejectedObjects = objectTasks.filter(t => t.status === 'rejected');
    const pendingNodes = nodeTasks.filter(t => t.status === 'pending');
    const approvedNodes = nodeTasks.filter(t => t.status === 'approved');

    // Tab availability
    const objectsTabEnabled = getStepIndex(highestStage) >= getStepIndex('objectReview');
    const nodesTabEnabled = getStepIndex(highestStage) >= getStepIndex('nodeReview');

    // Panel width styles
    const panelWidth = panelSize === 'collapsed' ? 'w-12' : panelSize === 'expanded' ? 'w-[55%]' : 'w-[420px]';

    // Use uploaded PDF files
    const viewerFiles: PdfFile[] = pdfFiles;

    // Build mock node overlays from nodeTasks
    const NODE_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ef4444', '#ec4899'];
    const nodeOverlays: NodeOverlay[] = useMemo(() => nodeTasks.map((task, i) => ({
        label: task.title,
        color: NODE_COLORS[i % NODE_COLORS.length],
        x: 40 + (i % 3) * 200,
        y: 60 + Math.floor(i / 3) * 180,
        width: 180,
        height: 140,
    })), [nodeTasks]);

    if (loading) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Loading...</div>;
    }
    if (!project) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Project not found.</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] -m-8">
            {/* ─── Step Bubble Header ────────────────────── */}
            <div className="flex-shrink-0 px-6 py-3 bg-white border-b" style={{ borderColor: 'var(--color-slate-200)' }}>
                <StepBubbles
                    currentStage={workflowStage}
                    highestStage={highestStage}
                    onStepClick={navigateToStage}
                />
            </div>

            {/* ─── Main Content Area ─────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
                {/* ─── Left: Viewer with Tabs ────────────── */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                    {/* Viewer Tab Bar */}
                    <div className="flex-shrink-0 flex items-center gap-0 bg-white border-b px-2" style={{ borderColor: 'var(--color-slate-200)' }}>
                        {([
                            { key: 'pid' as ViewerTab, label: 'P&ID View', icon: FileText, enabled: true },
                            { key: 'objects' as ViewerTab, label: 'Object Detection', icon: Box, enabled: objectsTabEnabled },
                            { key: 'nodes' as ViewerTab, label: 'Node Detection', icon: GitBranch, enabled: nodesTabEnabled },
                        ]).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => tab.enabled && setViewerTab(tab.key)}
                                disabled={!tab.enabled}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${viewerTab === tab.key
                                    ? 'border-[var(--color-primary-500)] text-[var(--color-primary-600)]'
                                    : tab.enabled
                                        ? 'border-transparent text-[var(--color-slate-500)] hover:text-[var(--color-slate-700)] hover:border-[var(--color-slate-300)]'
                                        : 'border-transparent text-[var(--color-slate-300)] cursor-not-allowed'
                                    }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Viewer Content */}
                    <div className="flex-1 overflow-hidden relative">
                        {viewerTab === 'pid' && (
                            viewerFiles.length > 0 ? (
                                <PdfViewer files={viewerFiles} />
                            ) : (
                                <div className="h-full flex items-center justify-center p-8">
                                    <div className="text-center">
                                        <FileText size={48} className="mx-auto mb-4" style={{ color: 'var(--color-slate-300)' }} />
                                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-slate-700)' }}>No P&ID Uploaded</h3>
                                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Upload a P&ID drawing to get started</p>
                                    </div>
                                </div>
                            )
                        )}
                        {viewerTab === 'objects' && (
                            viewerFiles.length > 0 ? (
                                <PdfViewer files={viewerFiles} showPredictions />
                            ) : (
                                <div className="h-full flex items-center justify-center p-8">
                                    <div className="text-center">
                                        <Box size={48} className="mx-auto mb-4" style={{ color: 'var(--color-slate-300)' }} />
                                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-slate-700)' }}>Object Detection View</h3>
                                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Upload a P&ID to see detected objects</p>
                                    </div>
                                </div>
                            )
                        )}
                        {viewerTab === 'nodes' && (
                            viewerFiles.length > 0 ? (
                                <PdfViewer files={viewerFiles} nodeOverlays={[]} />
                            ) : (
                                <div className="h-full flex items-center justify-center p-8">
                                    <div className="text-center">
                                        <GitBranch size={48} className="mx-auto mb-4" style={{ color: 'var(--color-slate-300)' }} />
                                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-slate-700)' }}>Node Detection View</h3>
                                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Upload a P&ID to see node assignments</p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* ─── Right: Workflow Panel ──────────────── */}
                <div className={`${panelWidth} border-l flex flex-col overflow-hidden bg-white transition-all duration-300`} style={{ borderColor: 'var(--color-slate-200)' }}>
                    {/* Panel header with collapse/expand toggle */}
                    <div className="flex-shrink-0 flex items-center justify-between p-2 border-b" style={{ borderColor: 'var(--color-slate-200)', backgroundColor: 'var(--color-slate-50)' }}>
                        {panelSize !== 'collapsed' && (
                            <span className="text-xs font-semibold px-2 uppercase tracking-wider" style={{ color: 'var(--color-slate-500)' }}>
                                Workflow
                            </span>
                        )}
                        <div className={`flex items-center gap-0.5 ${panelSize === 'collapsed' ? 'mx-auto' : 'ml-auto'}`}>
                            {panelSize !== 'collapsed' && (
                                <button
                                    onClick={() => setPanelSize(panelSize === 'expanded' ? 'normal' : 'expanded')}
                                    className="p-1.5 rounded hover:bg-white transition-colors"
                                    style={{ color: 'var(--color-slate-400)' }}
                                    title={panelSize === 'expanded' ? 'Normal size' : 'Expand panel'}
                                >
                                    {panelSize === 'expanded' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                </button>
                            )}
                            <button
                                onClick={() => setPanelSize(panelSize === 'collapsed' ? 'normal' : 'collapsed')}
                                className="p-1.5 rounded hover:bg-white transition-colors"
                                style={{ color: 'var(--color-slate-400)' }}
                                title={panelSize === 'collapsed' ? 'Open panel' : 'Collapse panel'}
                            >
                                {panelSize === 'collapsed' ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Panel content – hidden when collapsed */}
                    {panelSize !== 'collapsed' && (
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {/* ── Upload stage ── */}
                            {workflowStage === 'upload' && (
                                <div className="text-center py-12">
                                    <FileText size={48} className="mx-auto mb-4" style={{ color: 'var(--color-slate-300)' }} />
                                    <h3 className="font-medium mb-2" style={{ color: 'var(--color-slate-700)' }}>Upload your P&ID</h3>
                                    <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>Upload a P&ID drawing to begin AI-assisted object detection.</p>
                                    <button onClick={handleStartDetection} className="btn btn-primary">
                                        <Play size={16} />
                                        {objectTasks.length > 0 ? 'Continue to Review' : 'Start Detection'}
                                    </button>
                                </div>
                            )}

                            {/* ── Object Detection (loading, error, or finished) ── */}
                            {workflowStage === 'objectDetection' && (
                                isDetecting ? (
                                    <div className="text-center py-12">
                                        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--color-slate-200)', borderTopColor: 'var(--color-primary-500)' }} />
                                        <p className="font-medium" style={{ color: 'var(--color-slate-700)' }}>Analyzing P&ID...</p>
                                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>AI is detecting equipment and instruments</p>
                                        <p className="text-xs mt-2" style={{ color: 'var(--color-slate-400)' }}>This may take 15–30 seconds</p>
                                    </div>
                                ) : detectionError ? (
                                    <div className="text-center py-12">
                                        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-100">
                                            <AlertCircle size={28} className="text-red-600" />
                                        </div>
                                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-slate-800)' }}>Detection Failed</h3>
                                        <p className="text-sm mb-4 px-4" style={{ color: 'var(--color-red-600, #dc2626)' }}>{detectionError}</p>
                                        <button onClick={runObjectDetection} className="btn btn-primary">
                                            <RotateCcw size={16} /> Retry Detection
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100">
                                            <Check size={28} className="text-green-600" />
                                        </div>
                                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-slate-800)' }}>Object Detection Complete</h3>
                                        <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                                            {objectTasks.length} objects detected
                                        </p>
                                        <div className="flex flex-col gap-2 items-center">
                                            <button onClick={runObjectDetection} className="btn btn-secondary text-xs">
                                                <RotateCcw size={14} /> Re-run Detection
                                            </button>
                                            <button onClick={handleStartDetection} className="btn btn-primary">
                                                <Play size={16} /> Continue to Review
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* ── Object Review with Pending / Approved tabs ── */}
                            {workflowStage === 'objectReview' && (
                                <>
                                    <h3 className="font-semibold" style={{ color: 'var(--color-slate-800)' }}>Review Objects</h3>

                                    {/* Sub-tabs */}
                                    <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-slate-200)' }}>
                                        <button
                                            onClick={() => setReviewTab('pending')}
                                            className={`flex-1 py-2 text-xs font-medium text-center transition-all ${reviewTab === 'pending' ? 'bg-white shadow-sm' : ''}`}
                                            style={{
                                                color: reviewTab === 'pending' ? 'var(--color-primary-600)' : 'var(--color-slate-500)',
                                                backgroundColor: reviewTab !== 'pending' ? 'var(--color-slate-50)' : undefined,
                                            }}
                                        >
                                            Pending ({pendingObjects.length})
                                        </button>
                                        <button
                                            onClick={() => setReviewTab('approved')}
                                            className={`flex-1 py-2 text-xs font-medium text-center transition-all border-l ${reviewTab === 'approved' ? 'bg-white shadow-sm' : ''}`}
                                            style={{
                                                color: reviewTab === 'approved' ? 'var(--color-success-600, #16a34a)' : 'var(--color-slate-500)',
                                                backgroundColor: reviewTab !== 'approved' ? 'var(--color-slate-50)' : undefined,
                                                borderColor: 'var(--color-slate-200)',
                                            }}
                                        >
                                            Approved ({approvedObjects.length})
                                        </button>
                                    </div>

                                    {/* Task List */}
                                    <div className="space-y-2">
                                        {reviewTab === 'pending' ? (
                                            pendingObjects.length > 0 ? (
                                                pendingObjects.map(task => (
                                                    <TaskCard
                                                        key={task.id}
                                                        task={task}
                                                        taskType="object"
                                                        onAction={handleTaskAction}
                                                        onSave={handleSaveTask}
                                                        onDelete={() => handleDeleteTask('object', task.id)}
                                                    />
                                                ))
                                            ) : (
                                                objectTasks.length === 0 ? (
                                                    <div className="text-center py-6">
                                                        <AlertCircle size={24} className="mx-auto mb-2" style={{ color: 'var(--color-slate-400)' }} />
                                                        <p className="text-sm mb-3" style={{ color: 'var(--color-slate-500)' }}>No objects detected yet.</p>
                                                        <button onClick={runObjectDetection} className="btn btn-secondary text-xs">
                                                            <RotateCcw size={14} /> Run Object Detection
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-6">
                                                        <Check size={24} className="mx-auto mb-2 text-green-500" />
                                                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>All objects reviewed!</p>
                                                    </div>
                                                )
                                            )
                                        ) : (
                                            approvedObjects.length > 0 ? (
                                                approvedObjects.map(task => (
                                                    <TaskCard
                                                        key={task.id}
                                                        task={task}
                                                        taskType="object"
                                                        onAction={handleTaskAction}
                                                        /* onEdit passed to allow reverting status */
                                                        onEdit={handleEditTask}
                                                        onSave={handleSaveTask}
                                                        onDelete={() => handleDeleteTask('object', task.id)}
                                                    />
                                                ))
                                            ) : (
                                                <div className="text-center py-6">
                                                    <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>No approved objects yet.</p>
                                                </div>
                                            )
                                        )}

                                        {/* Rejected section (collapsed) */}
                                        {rejectedObjects.length > 0 && reviewTab === 'pending' && (
                                            <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--color-slate-100)' }}>
                                                <p className="text-xs font-medium mb-2 text-red-500">Rejected ({rejectedObjects.length})</p>
                                                {rejectedObjects.map(task => (
                                                    <TaskCard
                                                        key={task.id}
                                                        task={task}
                                                        taskType="object"
                                                        onAction={handleTaskAction}
                                                        onEdit={handleEditTask}
                                                        onSave={handleSaveTask}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Object button / form */}
                                    {showAddObject ? (
                                        <AddTaskForm
                                            taskType="object"
                                            onAdd={(title, desc, extra) => handleAddManualTask('object', title, desc, extra)}
                                            onCancel={() => setShowAddObject(false)}
                                        />
                                    ) : (
                                        <button onClick={() => setShowAddObject(true)} className="btn btn-secondary w-full text-xs">
                                            <Plus size={14} /> Add Object Manually
                                        </button>
                                    )}

                                    {/* Re-run detection button */}
                                    {objectTasks.length > 0 && (
                                        <button onClick={runObjectDetection} className="btn btn-secondary w-full text-xs" style={{ color: 'var(--color-slate-500)' }}>
                                            <RotateCcw size={14} /> Re-run Object Detection
                                        </button>
                                    )}

                                    {allObjectsReviewed && (
                                        <button onClick={handleContinueToNodes} className="btn btn-primary w-full mt-2">
                                            <Play size={16} />
                                            {nodeTasks.length > 0 ? 'Continue to Node Review' : 'Continue to Node Detection'}
                                        </button>
                                    )}
                                </>
                            )}

                            {/* ── Node Detection (loading or finished) ── */}
                            {workflowStage === 'nodeDetection' && (
                                isDetecting ? (
                                    <div className="text-center py-12">
                                        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--color-slate-200)', borderTopColor: 'var(--color-primary-500)' }} />
                                        <p className="font-medium" style={{ color: 'var(--color-slate-700)' }}>Assigning Nodes...</p>
                                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>AI is grouping equipment into HAZOP nodes</p>
                                    </div>
                                ) : detectionError ? (
                                    <div className="text-center py-12">
                                        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-100">
                                            <AlertCircle size={28} className="text-red-600" />
                                        </div>
                                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-slate-800)' }}>Detection Failed</h3>
                                        <p className="text-sm mb-4 px-4" style={{ color: 'var(--color-red-600, #dc2626)' }}>{detectionError}</p>
                                        <button onClick={runNodeDetection} className="btn btn-primary">
                                            <RotateCcw size={16} /> Retry Detection
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100">
                                            <Check size={28} className="text-green-600" />
                                        </div>
                                        <h3 className="font-semibold mb-1" style={{ color: 'var(--color-slate-800)' }}>Node Detection Complete</h3>
                                        <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                                            {nodeTasks.length} nodes detected
                                        </p>
                                        <div className="flex flex-col gap-2 items-center">
                                            <button onClick={runNodeDetection} className="btn btn-secondary text-xs">
                                                <RotateCcw size={14} /> Re-run Detection
                                            </button>
                                            <button onClick={() => setWorkflowStage('nodeReview')} className="btn btn-primary">
                                                <Play size={16} /> Continue to Review
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* ── Node Review with Pending / Approved tabs ── */}
                            {workflowStage === 'nodeReview' && (
                                <>
                                    <h3 className="font-semibold" style={{ color: 'var(--color-slate-800)' }}>Review Nodes</h3>

                                    {/* Sub-tabs */}
                                    <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-slate-200)' }}>
                                        <button
                                            onClick={() => setReviewTab('pending')}
                                            className={`flex-1 py-2 text-xs font-medium text-center transition-all ${reviewTab === 'pending' ? 'bg-white shadow-sm' : ''}`}
                                            style={{
                                                color: reviewTab === 'pending' ? 'var(--color-primary-600)' : 'var(--color-slate-500)',
                                                backgroundColor: reviewTab !== 'pending' ? 'var(--color-slate-50)' : undefined,
                                            }}
                                        >
                                            Pending ({pendingNodes.length})
                                        </button>
                                        <button
                                            onClick={() => setReviewTab('approved')}
                                            className={`flex-1 py-2 text-xs font-medium text-center transition-all border-l ${reviewTab === 'approved' ? 'bg-white shadow-sm' : ''}`}
                                            style={{
                                                color: reviewTab === 'approved' ? 'var(--color-success-600, #16a34a)' : 'var(--color-slate-500)',
                                                backgroundColor: reviewTab !== 'approved' ? 'var(--color-slate-50)' : undefined,
                                                borderColor: 'var(--color-slate-200)',
                                            }}
                                        >
                                            Approved ({approvedNodes.length})
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {reviewTab === 'pending' ? (
                                            pendingNodes.length > 0 ? (
                                                pendingNodes.map(task => (
                                                    <TaskCard
                                                        key={task.id}
                                                        task={task}
                                                        taskType="node"
                                                        onAction={handleTaskAction}
                                                        onSave={handleSaveTask}
                                                        onDelete={() => handleDeleteTask('node', task.id)}
                                                    />
                                                ))
                                            ) : (
                                                <div className="text-center py-6">
                                                    <Check size={24} className="mx-auto mb-2 text-green-500" />
                                                    <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>All nodes reviewed!</p>
                                                </div>
                                            )
                                        ) : (
                                            approvedNodes.length > 0 ? (
                                                approvedNodes.map(task => (
                                                    <TaskCard
                                                        key={task.id}
                                                        task={task}
                                                        taskType="node"
                                                        onAction={handleTaskAction}
                                                        onEdit={handleEditTask}
                                                        onSave={handleSaveTask}
                                                        onDelete={() => handleDeleteTask('node', task.id)}
                                                    />
                                                ))
                                            ) : (
                                                <div className="text-center py-6">
                                                    <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>No approved nodes yet.</p>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Add Node button / form */}
                                    {showAddNode ? (
                                        <AddTaskForm
                                            taskType="node"
                                            onAdd={(title, desc, extra) => handleAddManualTask('node', title, desc, extra)}
                                            onCancel={() => setShowAddNode(false)}
                                        />
                                    ) : (
                                        <button onClick={() => setShowAddNode(true)} className="btn btn-secondary w-full text-xs">
                                            <Plus size={14} /> Add Node Manually
                                        </button>
                                    )}

                                    {/* Re-run detection button */}
                                    {nodeTasks.length > 0 && (
                                        <button onClick={runNodeDetection} className="btn btn-secondary w-full text-xs" style={{ color: 'var(--color-slate-500)' }}>
                                            <RotateCcw size={14} /> Re-run Node Detection
                                        </button>
                                    )}

                                    {allNodesReviewed && (
                                        <button onClick={() => setWorkflowStage('completed')} className="btn btn-primary w-full mt-2">
                                            <Check size={16} />
                                            Complete Onboarding
                                        </button>
                                    )}
                                </>
                            )}

                            {/* ── Completed ── */}
                            {workflowStage === 'completed' && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--color-success-500)' }}>
                                        <Check size={32} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-slate-900)' }}>Onboarding Complete!</h3>
                                    <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                                        {confirmedNodes.length} nodes confirmed and ready for HAZOP analysis.
                                    </p>
                                    <button onClick={() => router.push(`/projects/${id}/hazop-analysis`)} className="btn btn-primary">
                                        <Eye size={16} />
                                        Start HAZOP Analysis
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Pulse animation */}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 0 4px rgba(99,102,241,0.2); }
                    50% { box-shadow: 0 0 0 8px rgba(99,102,241,0.1); }
                }
            `}</style>
        </div>
    );
}
