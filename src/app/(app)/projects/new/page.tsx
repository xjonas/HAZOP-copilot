'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ArrowRight,
    Upload,
    FileText,
    Check,
    X,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useOrgMembers } from '@/hooks/useOrgMembers';


const steps = [
    { id: 1, title: 'Project Details' },
    { id: 2, title: 'Process Information' },
    { id: 3, title: 'Data & Connections' },
    { id: 4, title: 'Review & Create' },
];

export default function NewProjectPage() {
    const router = useRouter();
    const { addProject, uploadFile } = useProjects();
    const [currentStep, setCurrentStep] = useState(1);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        responsiblePerson: '',
        location: '',
        deadline: '',
        processDescription: '',
        processType: '',
        pidFiles: [] as File[], // Store actual File objects for upload
        knowledgeBase: '',
    });

    const updateField = (field: string, value: string | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const { orgMembers } = useOrgMembers();

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;
        // Allow PDF and images
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
        const selectedFiles = Array.from(files).filter(f => validTypes.includes(f.type));

        if (selectedFiles.length > 0) {
            setFormData(prev => ({ ...prev, pidFiles: [...prev.pidFiles, ...selectedFiles] }));
        }
    };

    const handleRemoveFile = (index: number) => {
        setFormData(prev => ({ ...prev, pidFiles: prev.pidFiles.filter((_, i) => i !== index) }));
    };

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const validateStep = (step: number) => {
        const errors: Record<string, string> = {};
        let isValid = true;

        if (step === 1) {
            if (!formData.name.trim()) {
                errors.name = 'Project Name is required';
                isValid = false;
            }
            if (!formData.deadline) {
                errors.deadline = 'Input date';
                isValid = false;
            }
        }

        // Optional: Add validation for other steps if needed
        // if (step === 2 && !formData.processType) { ... }

        setFormErrors(errors);
        return isValid;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleCreate = async () => {
        if (!validateStep(currentStep)) return;

        setIsCreating(true);
        setCreateError(null);
        try {
            const created = await addProject({
                name: formData.name,
                description: formData.description,
                responsiblePerson: formData.responsiblePerson,
                location: formData.location,
                deadline: formData.deadline,
                processDescription: formData.processDescription,
            });

            // Upload files to Supabase Storage
            for (const file of formData.pidFiles) {
                await uploadFile(created.id, file);
            }

            router.push(`/projects/${created.id}/dashboard`);
        } catch (err) {
            const message = err instanceof Error
                ? err.message
                : (typeof err === 'string'
                    ? err
                    : (typeof (err as { message?: unknown } | null)?.message === 'string'
                        ? (err as { message: string }).message
                        : 'Failed to create project. Please try again.'));
            console.error('Error creating project:', {
                error: err,
                message,
                serialized: (() => {
                    try {
                        return JSON.stringify(err);
                    } catch {
                        return '[unserializable]';
                    }
                })(),
            });
            setCreateError(message);
            setIsCreating(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Stepper */}
            <div className="flex items-center justify-between mb-8">
                {steps.map((step, i) => (
                    <React.Fragment key={step.id}>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                                style={{
                                    backgroundColor: currentStep >= step.id ? 'var(--color-primary-600)' : 'var(--color-slate-200)',
                                    color: currentStep >= step.id ? 'white' : 'var(--color-slate-500)',
                                }}
                            >
                                {currentStep > step.id ? <Check size={16} /> : step.id}
                            </div>
                            <span className="text-sm font-medium hidden sm:block" style={{ color: currentStep >= step.id ? 'var(--color-slate-800)' : 'var(--color-slate-400)' }}>
                                {step.title}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className="flex-1 h-px mx-4" style={{ backgroundColor: currentStep > step.id ? 'var(--color-primary-400)' : 'var(--color-slate-200)' }} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Step Content */}
            <div className="card p-8 space-y-6">
                {createError && (
                    <div
                        className="text-sm p-3 rounded-lg"
                        style={{
                            backgroundColor: '#fef2f2',
                            color: 'var(--color-danger-600)',
                            border: '1px solid #fecaca',
                        }}
                    >
                        {createError}
                    </div>
                )}
                {currentStep === 1 && (
                    <>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>Project Details</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Project Name *</label>
                                <input
                                    className={`input ${formErrors.name ? 'border-red-500 focus:ring-red-200' : ''}`}
                                    value={formData.name}
                                    onChange={e => {
                                        updateField('name', e.target.value);
                                        if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                                    }}
                                    placeholder="e.g., Reactor Unit HAZOP"
                                />
                                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>One Line Description</label>
                                <input className="input" value={formData.description} onChange={e => updateField('description', e.target.value)} placeholder="Brief one-line overview..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Responsible Person (Team Lead)</label>
                                    <select
                                        className="input"
                                        value={formData.responsiblePerson}
                                        onChange={e => updateField('responsiblePerson', e.target.value)}
                                    >
                                        <option value="">Select a team lead...</option>
                                        {orgMembers.map((member, i) => (
                                            <option key={member.id || i} value={member.full_name}>
                                                {member.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Location</label>
                                    <input className="input" value={formData.location} onChange={e => updateField('location', e.target.value)} placeholder="Plant location" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Deadline *</label>
                                <input
                                    className={`input ${formErrors.deadline ? 'border-red-500 focus:ring-red-200' : ''}`}
                                    type="date"
                                    value={formData.deadline}
                                    onChange={e => {
                                        updateField('deadline', e.target.value);
                                        if (formErrors.deadline) setFormErrors(prev => ({ ...prev, deadline: '' }));
                                    }}
                                />
                                {formErrors.deadline && <p className="text-red-500 text-xs mt-1">{formErrors.deadline}</p>}
                            </div>
                        </div>
                    </>
                )}

                {currentStep === 2 && (
                    <>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>Process Information</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Process Type</label>
                                <select className="input" value={formData.processType} onChange={e => updateField('processType', e.target.value)}>
                                    <option value="">Select process type</option>
                                    <option value="chemical">Chemical Process</option>
                                    <option value="refinery">Refinery</option>
                                    <option value="pharmaceutical">Pharmaceutical</option>
                                    <option value="petrochemical">Petrochemical</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Detailed Description</label>
                                <textarea className="input" rows={6} value={formData.processDescription} onChange={e => updateField('processDescription', e.target.value)} placeholder="Describe the process to be analyzed..." />
                            </div>
                        </div>
                    </>
                )}

                {currentStep === 3 && (
                    <>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>Data & Connections</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-slate-700)' }}>Upload P&ID (PDF or Image)</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf, .png, .jpg, .jpeg, .webp"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                />
                                <div
                                    className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-[var(--color-primary-400)] transition-colors"
                                    style={{ borderColor: 'var(--color-slate-300)' }}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileSelect(e.dataTransfer.files); }}
                                >
                                    <Upload size={32} className="mx-auto mb-3" style={{ color: 'var(--color-slate-400)' }} />
                                    <p className="text-sm" style={{ color: 'var(--color-slate-600)' }}>Drag & drop PDF or Image here, or click to select</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-slate-400)' }}>Supports .pdf, .png, .jpg files up to 50MB</p>

                                </div>
                                {formData.pidFiles.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {formData.pidFiles.map((file, i) => (
                                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-slate-50)' }}>
                                                <FileText size={16} style={{ color: 'var(--color-primary-600)' }} />
                                                <span className="text-sm flex-1" style={{ color: 'var(--color-slate-700)' }}>{file.name}</span>
                                                <button onClick={() => handleRemoveFile(i)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>Knowledge Base / Accident Database</label>
                                <textarea className="input" rows={3} value={formData.knowledgeBase} onChange={e => updateField('knowledgeBase', e.target.value)} placeholder="Paste relevant safety data or references..." />
                            </div>
                        </div>
                    </>
                )}

                {currentStep === 4 && (
                    <>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>Review & Create</h2>
                        <div className="space-y-4">
                            <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-slate-50)' }}>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span style={{ color: 'var(--color-slate-500)' }}>Name:</span> <strong>{formData.name || '—'}</strong></div>
                                    <div><span style={{ color: 'var(--color-slate-500)' }}>Responsible:</span> <strong>{formData.responsiblePerson || '—'}</strong></div>
                                    <div><span style={{ color: 'var(--color-slate-500)' }}>Location:</span> <strong>{formData.location || '—'}</strong></div>
                                    <div><span style={{ color: 'var(--color-slate-500)' }}>Deadline:</span> <strong>{formData.deadline || '—'}</strong></div>
                                    <div className="col-span-2"><span style={{ color: 'var(--color-slate-500)' }}>One Line Description:</span> <strong>{formData.description || '—'}</strong></div>
                                    <div className="col-span-2"><span style={{ color: 'var(--color-slate-500)' }}>Process Type:</span> <strong>{formData.processType || '—'}</strong></div>
                                    <div className="col-span-2"><span style={{ color: 'var(--color-slate-500)' }}>Detailed Description:</span> <strong>{formData.processDescription || '—'}</strong></div>
                                    {formData.pidFiles.length > 0 && (
                                        <div className="col-span-2"><span style={{ color: 'var(--color-slate-500)' }}>Files:</span> <strong>{formData.pidFiles.map(f => f.name).join(', ')}</strong></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-6">
                <button
                    onClick={() => currentStep === 1 ? router.push('/projects') : setCurrentStep(s => s - 1)}
                    className="btn btn-secondary"
                >
                    <ArrowLeft size={16} />
                    {currentStep === 1 ? 'Cancel' : 'Back'}
                </button>
                {currentStep < 4 ? (
                    <button
                        onClick={handleNext}
                        className="btn btn-primary"
                    >
                        Next <ArrowRight size={16} />
                    </button>
                ) : (
                    <button onClick={handleCreate} className="btn btn-primary" disabled={isCreating}>
                        <Check size={16} />
                        {isCreating ? 'Creating...' : 'Create Project'}
                    </button>
                )}
            </div>
        </div>
    );
}
