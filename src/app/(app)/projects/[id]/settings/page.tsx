'use client';

import React, { useState, useEffect } from 'react';
import { use } from 'react';
import { Save, Check } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { getProject, updateProject, loading } = useProjects();
    const project = getProject(id);

    const [form, setForm] = useState({
        name: '',
        description: '',
        responsiblePerson: '',
        location: '',
        deadline: '',
        processDescription: '',
    });
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!project) return;
        setForm({
            name: project.name || '',
            description: project.description || '',
            responsiblePerson: project.responsiblePerson || '',
            location: project.location || '',
            deadline: project.deadline || '',
            processDescription: project.processDescription || '',
        });
    }, [project]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProject(id, form);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Error saving settings:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Loading...</div>;
    }
    if (!project) {
        return <div className="text-center py-12" style={{ color: 'var(--color-slate-500)' }}>Project not found.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>Project Settings</h1>
                <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                    {saved ? <Check size={16} /> : <Save size={16} />}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </button>
            </div>

            <div className="card p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Project Name</label>
                    <input className="input" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Description</label>
                    <textarea className="input" rows={3} value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Responsible Person</label>
                        <input className="input" value={form.responsiblePerson} onChange={e => setForm(prev => ({ ...prev, responsiblePerson: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Location</label>
                        <input className="input" value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Deadline</label>
                    <input className="input" type="date" value={form.deadline} onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Process Description</label>
                    <textarea className="input" rows={5} value={form.processDescription} onChange={e => setForm(prev => ({ ...prev, processDescription: e.target.value }))} />
                </div>
            </div>
        </div>
    );
}
