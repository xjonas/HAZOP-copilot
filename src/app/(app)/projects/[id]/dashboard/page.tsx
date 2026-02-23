'use client';

import React, { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import {
    Calendar,
    User,
    MapPin,
    BarChart3,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ArrowRight,
    Download,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import type { Task, HazopRow } from '@/types';

const statusColors: Record<string, string> = {
    planning: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    'in-progress': 'bg-yellow-100 text-yellow-700',
    review: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
};

export default function ProjectDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { getProject, getTasks, updateProject, getHazopRows, loading } = useProjects();
    const project = getProject(id);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [approvedNodes, setApprovedNodes] = useState<Task[]>([]);
    const [nodeHazopRows, setNodeHazopRows] = useState<Record<string, HazopRow[]>>({});
    const [finishing, setFinishing] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);

    useEffect(() => {
        if (!project || dataLoaded) return;
        const load = async () => {
            try {
                const t = await getTasks(id);
                setTasks(t);

                const nodes = t.filter(task => task.taskType === 'node' && task.status === 'approved');
                setApprovedNodes(nodes);

                const hazopData: Record<string, HazopRow[]> = {};
                await Promise.all(nodes.map(async (node) => {
                    const rows = await getHazopRows(node.id);
                    hazopData[node.id] = rows;
                }));
                setNodeHazopRows(hazopData);

                setDataLoaded(true);
            } catch (err) {
                console.error('Error loading dashboard data:', err);
                setDataLoaded(true);
            }
        };
        load();
    }, [project, id, dataLoaded, getTasks, getHazopRows]);

    if (loading) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Loading...</div>;
    }
    if (!project) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Project not found.</div>;
    }

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const approvedTasks = tasks.filter(t => t.status === 'approved');
    const totalTasks = tasks.length;
    const daysUntilDeadline = project.deadline
        ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    const isHazopComplete = approvedNodes.length > 0 && approvedNodes.every(node => {
        const rows = nodeHazopRows[node.id];
        return rows && rows.length > 0;
    });

    const handleFinishHazop = async () => {
        if (!isHazopComplete) return;

        const confirmed = window.confirm("Are you sure you want to finalize the HAZOP Analysis? This will complete the project.");
        if (!confirmed) return;

        setFinishing(true);
        try {
            await updateProject(id, { status: 'completed', progress: 100 });

            // Generate CSV
            let csvContent = "Node Title,Guide Word,Parameter,Deviation,Causes,Consequences,Safeguards,Recommendations,Severity,Likelihood,Risk\n";

            approvedNodes.forEach(node => {
                const rows = nodeHazopRows[node.id] || [];
                rows.forEach(row => {
                    const escape = (str: string | number) => `"${String(str || '').replace(/"/g, '""')}"`;
                    csvContent += [
                        escape(node.title),
                        escape(row.guideWord),
                        escape(row.parameter),
                        escape(row.deviation),
                        escape(row.causes),
                        escape(row.consequences),
                        escape(row.safeguards),
                        escape(row.recommendations),
                        row.severity,
                        row.likelihood,
                        row.severity * row.likelihood
                    ].join(',') + "\n";
                });
            });

            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${project.name.replace(/\s+/g, '_')}_HAZOP_Analysis.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error("Failed to finish HAZOP:", err);
            alert("Failed to finish HAZOP. Please try again.");
        } finally {
            setFinishing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Project header */}
            <div className="card p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>{project.name}</h1>
                            {project.status && (
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[project.status ?? ''] || 'bg-gray-100 text-gray-700'}`}>
                                    {project.status}
                                </span>
                            )}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>{project.description || 'No description'}</p>
                    </div>

                    {/* Finish Project Button */}
                    <button
                        onClick={handleFinishHazop}
                        disabled={!isHazopComplete && project.status !== 'completed' || finishing}
                        className={`btn ${project.status === 'completed' ? 'btn-secondary text-green-600' : 'btn-primary'} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={!isHazopComplete && project.status !== 'completed' ? "Please ensure all approved Nodes have at least one HAZOP row." : undefined}
                    >
                        {project.status === 'completed' ? (
                            <>
                                <CheckCircle2 size={16} /> Download HAZOP CSV
                            </>
                        ) : finishing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent flex-shrink-0 rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Download size={16} /> Finish HAZOP
                            </>
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--color-slate-500)' }}>
                    {project.responsiblePerson && (
                        <span className="flex items-center gap-1.5"><User size={14} /> {project.responsiblePerson}</span>
                    )}
                    {project.location && (
                        <span className="flex items-center gap-1.5"><MapPin size={14} /> {project.location}</span>
                    )}
                    {project.deadline && (
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(project.deadline).toLocaleDateString()}</span>
                    )}
                </div>

                {/* Progress bar */}
                {project.progress > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium" style={{ color: 'var(--color-slate-600)' }}>Progress</span>
                            <span className="text-xs font-bold" style={{ color: 'var(--color-primary-600)' }}>{project.progress}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-slate-200)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, backgroundColor: 'var(--color-primary-500)' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                    <div className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-100)' }}>
                        <BarChart3 size={20} style={{ color: 'var(--color-primary-600)' }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-slate-900)' }}>{project.workflowStage || 'upload'}</p>
                    <p className="text-xs" style={{ color: 'var(--color-slate-500)' }}>Current Stage</p>
                </div>
                <div className="card p-4 text-center">
                    <div className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: '#fef3c7' }}>
                        <AlertTriangle size={20} style={{ color: '#d97706' }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-slate-900)' }}>{pendingTasks.length}</p>
                    <p className="text-xs" style={{ color: 'var(--color-slate-500)' }}>Pending Reviews</p>
                </div>
                <div className="card p-4 text-center">
                    <div className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: daysUntilDeadline !== null && daysUntilDeadline < 7 ? '#fef2f2' : 'var(--color-slate-100)' }}>
                        <Clock size={20} style={{ color: daysUntilDeadline !== null && daysUntilDeadline < 7 ? '#dc2626' : 'var(--color-slate-500)' }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-slate-900)' }}>
                        {daysUntilDeadline !== null ? `${daysUntilDeadline}d` : '—'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-slate-500)' }}>Days Until Deadline</p>
                </div>
            </div>

            {/* Review Inbox */}
            {pendingTasks.length > 0 && (
                <div className="card p-6">
                    <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-slate-800)' }}>Review Inbox</h2>
                    <div className="space-y-2">
                        {pendingTasks.slice(0, 5).map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--color-slate-50)' }}>
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-slate-800)' }}>{task.title}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-slate-500)' }}>{task.taskType} • {task.description}</p>
                                </div>
                                <Link href={`/projects/${id}/workspace`} className="btn btn-primary text-xs py-1.5 px-3">
                                    Review <ArrowRight size={12} />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
