import React, { useState } from 'react';
import { Check, X, Pencil, Save, ChevronDown, ChevronUp, Trash2, RotateCcw } from 'lucide-react';
import type { Task } from '@/types';

interface TaskCardProps {
    task: Task;
    taskType: 'object' | 'node';
    onAction: (taskType: 'object' | 'node', taskId: string, action: 'approved' | 'rejected') => void;
    onEdit?: (taskType: 'object' | 'node', taskId: string) => void; // Reset to pending
    onSave?: (taskId: string, updates: Partial<Task>) => Promise<void>; // Save structured data
    onDelete?: (taskId: string) => Promise<void>;
}

export default function TaskCard({ task, taskType, onAction, onEdit, onSave, onDelete }: TaskCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    // Edit state
    const [formData, setFormData] = useState({
        title: task.title,
        description: task.description,
        position: task.position || '',
        connections: task.connections || '',
        operatingConditions: task.operatingConditions || '',
        chemicals: task.chemicals || '',
        designIntent: task.designIntent || '',
        boundaries: task.boundaries || '',
        equipmentTags: task.equipmentTags || '',
        objects: task.objects || '',
    });

    const handleSave = async () => {
        if (!onSave) return;
        try {
            await onSave(task.id, formData);
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to save task:', err);
        }
    };

    const handleDelete = async () => {
        if (onDelete && window.confirm('Are you sure you want to delete this task? This cannot be undone.')) {
            await onDelete(task.id);
        }
    };

    // If editing, show form
    if (isEditing) {
        return (
            <div className="p-3 rounded-lg border border-primary-200 bg-primary-50 space-y-3">
                <div className="space-y-2">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Title</label>
                        <input
                            className="input text-sm w-full"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                        <textarea
                            className="input text-sm w-full"
                            rows={2}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Structured Fields */}
                    <div className="grid grid-cols-2 gap-2">
                        {taskType === 'object' && (
                            <>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Position</label>
                                    <input
                                        className="input text-xs w-full"
                                        placeholder="Relative location..."
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Connections</label>
                                    <input
                                        className="input text-xs w-full"
                                        placeholder="Inlet/outlet..."
                                        value={formData.connections}
                                        onChange={(e) => setFormData({ ...formData, connections: e.target.value })}
                                    />
                                </div>
                            </>
                        )}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Chemicals</label>
                            <input
                                className="input text-xs w-full"
                                placeholder="Chemicals involved..."
                                value={formData.chemicals}
                                onChange={(e) => setFormData({ ...formData, chemicals: e.target.value })}
                            />
                        </div>

                        {/* Object Specific Conditions */}
                        {taskType === 'object' && (
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Conditions</label>
                                <input
                                    className="input text-xs w-full"
                                    placeholder="Temp, pressure..."
                                    value={formData.operatingConditions}
                                    onChange={(e) => setFormData({ ...formData, operatingConditions: e.target.value })}
                                />
                            </div>
                        )}

                        {/* Node Specific Objects */}
                        {taskType === 'node' && (
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Objects</label>
                                <input
                                    className="input text-xs w-full"
                                    placeholder="R-101, P-102..."
                                    value={formData.objects}
                                    onChange={(e) => setFormData({ ...formData, objects: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    {/* Node Specific Fields */}
                    {taskType === 'node' && (
                        <div className="space-y-2 pt-2 border-t border-primary-200">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Design Intent</label>
                                <textarea
                                    className="input text-sm w-full"
                                    rows={2}
                                    value={formData.designIntent}
                                    onChange={(e) => setFormData({ ...formData, designIntent: e.target.value })}
                                    placeholder="e.g. To transfer feed from storage..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Boundaries</label>
                                <textarea
                                    className="input text-sm w-full"
                                    rows={2}
                                    value={formData.boundaries}
                                    onChange={(e) => setFormData({ ...formData, boundaries: e.target.value })}
                                    placeholder="e.g. From Tank A discharge to Reactor inlet..."
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase">Conditions</label>
                                <input
                                    className="input text-xs w-full"
                                    placeholder="Aggregated conditions..."
                                    value={formData.operatingConditions}
                                    onChange={(e) => setFormData({ ...formData, operatingConditions: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setIsEditing(false)}
                        className="btn btn-secondary text-xs py-1 px-3"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary text-xs py-1 px-3"
                    >
                        <Save size={14} /> Save
                    </button>
                </div>
            </div>
        );
    }

    // View Mode
    const hasStructuredData = task.position || task.connections || task.operatingConditions || task.chemicals || task.designIntent || task.boundaries || task.equipmentTags;

    return (
        <div className="p-3 rounded-lg border transition-all hover:shadow-sm bg-white border-slate-200">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {hasStructuredData && (
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="text-slate-400 hover:text-slate-600 focus:outline-none -ml-1"
                            >
                                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                        <p className="text-sm font-medium truncate text-slate-800">{task.title}</p>
                    </div>
                    <p className="text-xs mt-0.5 text-slate-500 line-clamp-2">{task.description}</p>

                    {/* Collapsible Details */}
                    {showDetails && hasStructuredData && (
                        <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            {taskType === 'object' && task.position && (
                                <div>
                                    <span className="font-semibold text-slate-500">Pos: </span>
                                    <span className="text-slate-700">{task.position}</span>
                                </div>
                            )}
                            {task.chemicals && (
                                <div>
                                    <span className="font-semibold text-slate-500">Chem: </span>
                                    <span className="text-slate-700">{task.chemicals}</span>
                                </div>
                            )}
                            {taskType === 'node' && task.objects && (
                                <div>
                                    <span className="font-semibold text-slate-500">Objects: </span>
                                    <span className="text-slate-700">{task.objects}</span>
                                </div>
                            )}
                            {taskType === 'object' && task.operatingConditions && (
                                <div className="col-span-2">
                                    <span className="font-semibold text-slate-500">Conditions: </span>
                                    <span className="text-slate-700">{task.operatingConditions}</span>
                                </div>
                            )}
                            {taskType === 'object' && task.connections && (
                                <div className="col-span-2">
                                    <span className="font-semibold text-slate-500">Conn: </span>
                                    <span className="text-slate-700">{task.connections}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Node Details - Approved View Refined */}
                    {showDetails && taskType === 'node' && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 text-xs">
                            {task.designIntent && (
                                <div>
                                    <span className="font-semibold text-slate-500 block">Design Intent:</span>
                                    <span className="text-slate-700">{task.designIntent}</span>
                                </div>
                            )}
                            {task.boundaries && (
                                <div>
                                    <span className="font-semibold text-slate-500 block">Boundaries:</span>
                                    <span className="text-slate-700">{task.boundaries}</span>
                                </div>
                            )}
                            {task.equipmentTags && (
                                <div>
                                    <span className="font-semibold text-slate-500 block">Equipment / Operations:</span>
                                    <span className="text-slate-700">{task.equipmentTags}</span>
                                </div>
                            )}
                            {task.operatingConditions && (
                                <div>
                                    <span className="font-semibold text-slate-500 block">Conditions:</span>
                                    <span className="text-slate-700">{task.operatingConditions}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    {task.status === 'pending' ? (
                        <>
                            {onSave && (
                                <button
                                    onClick={() => { setIsEditing(true); setShowDetails(true); }}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Edit Details"
                                >
                                    <Pencil size={14} />
                                </button>
                            )}
                            <button onClick={() => onAction(taskType, task.id, 'approved')} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Approve">
                                <Check size={16} />
                            </button>
                            {/* Deleted button with confirmation */}
                            {onDelete && (
                                <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${task.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {task.status}
                            </span>
                            {onEdit && (
                                <button
                                    onClick={() => onEdit(taskType, task.id)}
                                    className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                                    title="Revert to Pending"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            )}
                            {onSave && (
                                <button
                                    onClick={() => { setIsEditing(true); setShowDetails(true); }}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Edit Details"
                                >
                                    <Pencil size={13} />
                                </button>
                            )}
                            {onDelete && (
                                <button onClick={handleDelete} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
