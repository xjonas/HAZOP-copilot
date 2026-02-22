'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { use } from 'react';
import {
    Plus,
    Trash2,
    Save,
    Sparkles,
    AlertTriangle,
    ChevronDown,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { createClient } from '@/lib/supabase/client';
import type { Task, HazopRow } from '@/types';

const GUIDE_WORDS = ['No', 'More', 'Less', 'As Well As', 'Part Of', 'Reverse', 'Other Than', 'Early', 'Late', 'Before', 'After'];
const PARAMETERS = ['Flow', 'Pressure', 'Temperature', 'Level', 'Composition', 'Phase', 'Speed', 'Frequency', 'Time', 'Sequence'];

function riskColor(severity: number, likelihood: number): string {
    const risk = severity * likelihood;
    if (risk >= 15) return '#ef4444';
    if (risk >= 10) return '#f97316';
    if (risk >= 5) return '#eab308';
    return '#22c55e';
}

export default function HazopAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { getProject, getTasks, getHazopRows, upsertHazopRows, deleteHazopRow, loading } = useProjects();
    const project = getProject(id);

    const [approvedNodes, setApprovedNodes] = useState<Task[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [rows, setRows] = useState<HazopRow[]>([]);
    const [saving, setSaving] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Load approved node tasks
    useEffect(() => {
        if (!project || dataLoaded) return;
        const load = async () => {
            try {
                const tasks = await getTasks(id, 'node');
                const approved = tasks.filter(t => t.status === 'approved');
                setApprovedNodes(approved);
                if (approved.length > 0) setSelectedNodeId(approved[0].id);
                setDataLoaded(true);
            } catch (err) {
                console.error('Error loading nodes:', err);
                setDataLoaded(true);
            }
        };
        load();
    }, [project, id, dataLoaded, getTasks]);

    // Load HAZOP rows when selected node changes
    useEffect(() => {
        if (!selectedNodeId) return;
        const loadRows = async () => {
            try {
                const data = await getHazopRows(selectedNodeId);
                setRows(data);
            } catch (err) {
                console.error('Error loading HAZOP rows:', err);
            }
        };
        loadRows();
    }, [selectedNodeId, getHazopRows]);

    const selectedNode = approvedNodes.find(n => n.id === selectedNodeId);

    const addRow = () => {
        const newRow: HazopRow = {
            id: crypto.randomUUID(),
            nodeTaskId: selectedNodeId!,
            guideWord: '',
            parameter: '',
            deviation: '',
            causes: '',
            consequences: '',
            safeguards: '',
            recommendations: '',
            severity: 1,
            likelihood: 1,
            displayOrder: rows.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setRows(prev => [...prev, newRow]);
    };

    const updateRow = (rowId: string, field: keyof HazopRow, value: string | number) => {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    };

    const removeRow = async (rowId: string) => {
        try {
            await deleteHazopRow(rowId);
            setRows(prev => prev.filter(r => r.id !== rowId));
        } catch (err) {
            console.error('Error deleting HAZOP row:', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const saved = await upsertHazopRows(rows);
            setRows(saved);
        } catch (err) {
            console.error('Error saving HAZOP rows:', err);
        } finally {
            setSaving(false);
        }
    };

    const addAiSuggestion = async () => {
        if (!selectedNodeId) return;
        setIsGenerating(true);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('/api/ai/hazop-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ project_id: id, node_id: selectedNodeId })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate suggestions');
            }

            if (data.suggestions && Array.isArray(data.suggestions)) {
                const formattedSuggestions = data.suggestions.map((s: any, idx: number) => ({
                    id: crypto.randomUUID(),
                    nodeTaskId: selectedNodeId,
                    guideWord: s.guideWord || '',
                    parameter: s.parameter || '',
                    deviation: s.deviation || '',
                    causes: s.causes || '',
                    consequences: s.consequences || '',
                    safeguards: s.safeguards || '',
                    recommendations: s.recommendations || '',
                    severity: s.severity || 1,
                    likelihood: s.likelihood || 1,
                    displayOrder: rows.length + idx,
                }));

                setRows(prevRows => {
                    const newRows = [...prevRows, ...formattedSuggestions];
                    // Auto-save the new rows
                    upsertHazopRows(formattedSuggestions).catch(e => console.error("Auto-save failed:", e));
                    return newRows;
                });
            }
        } catch (err) {
            console.error('Error generating AI suggestions:', err);
            alert('Failed to generate suggestions. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Loading...</div>;
    }
    if (!project) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Project not found.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>HAZOP Analysis</h1>
                <div className="flex items-center gap-3">
                    <button onClick={addAiSuggestion} className="btn btn-secondary" disabled={!selectedNodeId || isGenerating}>
                        {isGenerating ? (
                            <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Sparkles size={16} />
                        )}
                        {isGenerating ? 'Generating...' : 'AI Suggestions'}
                    </button>
                    <button onClick={handleSave} className="btn btn-primary" disabled={saving || rows.length === 0}>
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Node selector */}
            {approvedNodes.length === 0 ? (
                <div className="card p-12 text-center">
                    <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: 'var(--color-slate-300)' }} />
                    <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--color-slate-700)' }}>No confirmed nodes</h3>
                    <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Complete the workspace onboarding to confirm nodes for HAZOP analysis.</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium" style={{ color: 'var(--color-slate-700)' }}>Node Selection:</label>
                        <div className="relative max-w-lg">
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-slate-500)' }} />
                            <select
                                value={selectedNodeId || ''}
                                onChange={e => setSelectedNodeId(e.target.value)}
                                className="input !pl-3 !pr-10 py-2.5 w-full appearance-none bg-white border border-slate-300 rounded-lg shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            >
                                {approvedNodes.map(n => (
                                    <option key={n.id} value={n.id}>{n.title}</option>
                                ))}
                            </select>
                        </div>
                        {selectedNode && (
                            <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm leading-relaxed max-w-lg" style={{ color: 'var(--color-slate-600)' }}>
                                <span className="font-semibold text-slate-700 block mb-1">Description:</span>
                                {selectedNode.description}
                            </div>
                        )}
                    </div>

                    {/* HAZOP Cards Grid */}
                    <div className="space-y-4">
                        {rows.map((row) => (
                            <div key={row.id} className="card p-5 border border-slate-200" style={{ backgroundColor: 'var(--color-white)' }}>
                                {/* Top Header: Guide Word, Parameter, Deviation */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-slate-600)' }}>Guide Word</label>
                                        <select className="input text-sm py-2 w-full" value={row.guideWord} onChange={e => updateRow(row.id, 'guideWord', e.target.value)}>
                                            <option value="">—</option>
                                            {GUIDE_WORDS.map(gw => <option key={gw} value={gw}>{gw}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-slate-600)' }}>Parameter</label>
                                        <select className="input text-sm py-2 w-full" value={row.parameter} onChange={e => updateRow(row.id, 'parameter', e.target.value)}>
                                            <option value="">—</option>
                                            {PARAMETERS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-slate-600)' }}>Deviation</label>
                                        <input className="input text-sm py-2 w-full" value={row.deviation} onChange={e => updateRow(row.id, 'deviation', e.target.value)} placeholder="e.g. High Pressure" />
                                    </div>
                                </div>

                                {/* Body: 2x2 Grid for analysis text */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-slate-600)' }}>Causes</label>
                                        <textarea className="input text-sm py-2 w-full" rows={3} value={row.causes} onChange={e => updateRow(row.id, 'causes', e.target.value)} placeholder="Potential causes of this deviation..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-slate-600)' }}>Consequences</label>
                                        <textarea className="input text-sm py-2 w-full" rows={3} value={row.consequences} onChange={e => updateRow(row.id, 'consequences', e.target.value)} placeholder="Impacts and consequences..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-slate-600)' }}>Safeguards</label>
                                        <textarea className="input text-sm py-2 w-full" rows={3} value={row.safeguards} onChange={e => updateRow(row.id, 'safeguards', e.target.value)} placeholder="Existing protective measures..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-slate-600)' }}>Recommendations</label>
                                        <textarea className="input text-sm py-2 w-full" rows={3} value={row.recommendations} onChange={e => updateRow(row.id, 'recommendations', e.target.value)} placeholder="Actionable recommendations..." />
                                    </div>
                                </div>

                                {/* Footer: Risk & Actions */}
                                <div className="flex flex-wrap items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--color-slate-100)' }}>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-semibold" style={{ color: 'var(--color-slate-600)' }}>Severity (S):</label>
                                            <select className="input text-sm py-1 w-16" value={row.severity} onChange={e => updateRow(row.id, 'severity', parseInt(e.target.value))}>
                                                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-semibold" style={{ color: 'var(--color-slate-600)' }}>Likelihood (L):</label>
                                            <select className="input text-sm py-1 w-16" value={row.likelihood} onChange={e => updateRow(row.id, 'likelihood', parseInt(e.target.value))}>
                                                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md">
                                            <label className="text-xs font-semibold" style={{ color: 'var(--color-slate-600)' }}>Risk Score:</label>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: riskColor(row.severity, row.likelihood) }} />
                                                <span className="text-sm font-bold">{row.severity * row.likelihood}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={() => removeRow(row.id)} className="btn btn-secondary !px-3 !bg-red-50 !text-red-500 hover:!bg-red-100 border-none transition-colors">
                                        <Trash2 size={16} className="mr-1" /> Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                        {rows.length === 0 && (
                            <div className="card p-12 text-center border-dashed border-2 bg-slate-50/50">
                                <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>No HAZOP rows yet. Click "Add Row" or "AI Suggestions" to begin.</p>
                            </div>
                        )}
                    </div>

                    <button onClick={addRow} className="btn btn-secondary" disabled={!selectedNodeId}>
                        <Plus size={16} />
                        Add Row
                    </button>

                    {/* Risk Matrix Legend */}
                    <div className="card p-4">
                        <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-slate-700)' }}>Risk Matrix Legend</h4>
                        <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--color-slate-600)' }}>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} /> Low (1-4)</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }} /> Medium (5-9)</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} /> High (10-14)</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }} /> Critical (15-25)</div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
