'use client';

import React, { useState, useEffect, useRef } from 'react';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Play,
    Square,
    Clock,
    Users,
    FileText,
    Plus,
    Mic,
    Upload,
    FileAudio,
    Sparkles,
    Check,
    Bot,
    Trash2,
    Save,
    X,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useMeetings } from '@/hooks/useMeetings';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import type { Meeting } from '@/types';

type Tab = 'overview' | 'transcript' | 'summary';

export default function MeetingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const targetMeetingId = searchParams?.get('meetingId');
    const { getProject, getSignedUrl, loading } = useProjects();
    const { getMeetings, addMeeting, updateMeeting, deleteMeeting, uploadMeetingRecording } = useMeetings();
    const { orgMembers } = useOrgMembers();
    const project = getProject(id);

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    // New Meeting State
    const [isCreating, setIsCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    // Form State
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingNotes, setMeetingNotes] = useState('');
    const [meetingAttendees, setMeetingAttendees] = useState<string[]>([]);
    const [transcript, setTranscript] = useState('');
    const [summary, setSummary] = useState('');

    // Recording/File State
    const [isRecording, setIsRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // AI Processing State
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Load data
    useEffect(() => {
        if (!project || dataLoaded) return;
        const load = async () => {
            try {
                const m = await getMeetings(id);
                setMeetings(m);
                setDataLoaded(true);

                if (targetMeetingId) {
                    const target = m.find(meet => meet.id === targetMeetingId);
                    if (target) {
                        setSelectedMeeting(target);
                        setIsCreating(false);
                    }
                }
            } catch (err) {
                console.error('Error loading meetings data:', err);
                setDataLoaded(true);
            }
        };
        load();
    }, [project, id, dataLoaded, getMeetings, targetMeetingId]);

    // Fetch audio URL when a meeting is selected
    useEffect(() => {
        if (selectedMeeting?.recordingPath) {
            getSignedUrl(selectedMeeting.recordingPath, 'meeting-recordings').then(setAudioUrl).catch(console.error);
        } else {
            setAudioUrl(null);
        }
    }, [selectedMeeting, getSignedUrl]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: Blob[] = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setRecordedChunks(chunks);
                // Create a file from the blob for simpler unified handling with upload
                const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
                setSelectedFile(file);

                // Cleanup stream tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        } catch (err) {
            console.error('Error starting recording:', err);
            alert('Could not access microphone. Please ensure permissions are granted.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setRecordedChunks([]); // Clear any recorded chunks if manual upload
        }
    };

    const handleTranscribe = async () => {
        if (!selectedFile) return;
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('projectId', id);

            const res = await fetch('/api/meetings/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Transcription failed');
            }

            const data = await res.json();
            setTranscript(data.text || '');
            setActiveTab('transcript');
        } catch (error: any) {
            console.error('Transcription error:', error);
            alert(error.message || 'Failed to transcribe audio. Please try again.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleSummarize = async () => {
        if (!transcript && !meetingNotes) {
            alert('Please provide notes or a transcript first.');
            return;
        }
        setIsSummarizing(true);
        try {
            const res = await fetch('/api/meetings/summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transcript, notes: meetingNotes, projectId: id }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Summarization failed');
            }

            const data = await res.json();
            setSummary(data.summary || '');
            setActiveTab('summary');
        } catch (error: any) {
            console.error('Summarization error:', error);
            alert(error.message || 'Failed to generate summary. Please try again.');
        } finally {
            setIsSummarizing(false);
        }
    };

    const saveMeeting = async () => {
        try {
            setIsUploading(true);

            let recordingPath = '';
            if (selectedFile) {
                try {
                    recordingPath = await uploadMeetingRecording(id, selectedFile);
                } catch (uploadErr) {
                    console.error('Upload failed:', uploadErr);
                    alert('Failed to upload recording, but saving meeting details.');
                }
            }

            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const duration = isRecording || recordedChunks.length > 0 ? `${mins}m ${secs}s` : (selectedFile ? 'Uploaded File' : '0m 0s');

            const payload: Partial<Meeting> = {
                title: meetingTitle || `Meeting ${meetings.length + 1}`,
                date: selectedMeeting?.date || new Date().toISOString(),
                attendees: meetingAttendees,
                notes: meetingNotes,
                summary,
                transcript,
                recording: isRecording || !!selectedFile || !!selectedMeeting?.recording,
                recordingPath: recordingPath || selectedMeeting?.recordingPath || undefined,
                duration: duration !== '0m 0s' ? duration : selectedMeeting?.duration || undefined,
            };

            let saved: Meeting;
            if (selectedMeeting && selectedMeeting.id) {
                saved = await updateMeeting(selectedMeeting.id, payload);
                setMeetings(prev => prev.map(m => m.id === saved.id ? saved : m));
            } else {
                payload.projectId = id;
                saved = await addMeeting(payload);
                setMeetings(prev => [saved, ...prev]);
            }

            resetForm();
            setSelectedMeeting(saved);
        } catch (err) {
            console.error('Error saving meeting:', err);
            alert('Failed to save meeting. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const deleteCurrentMeeting = async () => {
        if (!selectedMeeting) return;
        if (!confirm('Are you sure you want to delete this meeting? This cannot be undone.')) return;

        try {
            await deleteMeeting(selectedMeeting.id);
            setMeetings(prev => prev.filter(m => m.id !== selectedMeeting.id));
            setSelectedMeeting(null);
        } catch (err) {
            console.error('Error deleting meeting:', err);
            alert('Failed to delete meeting.');
        }
    };

    const resetForm = () => {
        setIsCreating(false);
        setMeetingTitle('');
        setMeetingNotes('');
        setMeetingAttendees([]);
        setTranscript('');
        setSummary('');
        setSelectedFile(null);
        setRecordedChunks([]);
        setElapsed(0);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const toggleAttendee = (name: string) => {
        setMeetingAttendees(prev =>
            prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
        );
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (loading) return <div className="text-center py-12 text-slate-500">Loading...</div>;
    if (!project) return <div className="text-center py-12 text-slate-500">Project not found.</div>;

    return (
        <div className="h-[calc(100vh-6rem)] grid grid-cols-12 gap-6 p-1">
            {/* LEFT: Meeting List */}
            <div className="col-span-4 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-semibold text-slate-800">Meetings</h2>
                    <button
                        onClick={() => { setIsCreating(true); setSelectedMeeting(null); }}
                        className="btn btn-primary btn-sm flex items-center gap-2"
                    >
                        <Plus size={16} /> New
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {meetings.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <FileText size={32} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No meetings yet.</p>
                        </div>
                    ) : (
                        meetings.map(m => (
                            <div
                                key={m.id}
                                onClick={() => { setSelectedMeeting(m); setIsCreating(false); }}
                                className={`p-4 rounded-lg cursor-pointer transition-all border ${selectedMeeting?.id === m.id
                                    ? 'bg-primary-50 border-primary-200 shadow-sm'
                                    : 'bg-white border-slate-200 hover:border-primary-200 hover:shadow-sm'
                                    }`}
                            >
                                <h3 className={`font-medium ${selectedMeeting?.id === m.id ? 'text-primary-900' : 'text-slate-800'}`}>
                                    {m.title}
                                </h3>
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(m.date).toLocaleDateString()}</span>
                                    {m.duration && <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-full">{m.duration}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT: Active Meeting / Details */}
            <div className="col-span-8 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {isCreating ? (
                    /* CREATE MODE */
                    <div className="flex flex-col h-full">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <input
                                type="text"
                                placeholder="Meeting Title (e.g., HAZOP Review Session 1)"
                                className="text-xl font-semibold bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-slate-400 text-slate-800"
                                value={meetingTitle}
                                onChange={e => setMeetingTitle(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Recording / Upload Section */}
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                    <Mic size={16} /> Audio Source
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Recording Control */}
                                    <div className={`bg-white p-4 rounded-lg border shadow-sm flex flex-col items-center justify-center gap-3 transition-colors ${isRecording ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                                        <div className={`text-2xl font-mono font-bold ${isRecording ? 'text-red-600' : 'text-slate-700'}`}>
                                            {formatTime(elapsed)}
                                        </div>
                                        {!isRecording ? (
                                            <button onClick={startRecording} className="btn btn-outline btn-sm w-full gap-2">
                                                <Mic size={14} /> Start Recording
                                            </button>
                                        ) : (
                                            <button onClick={stopRecording} className="btn btn-error btn-sm w-full gap-2 animate-pulse">
                                                <Square size={14} /> Stop Recording
                                            </button>
                                        )}
                                        {/* Show simple feedback if recorded */}
                                        {!isRecording && recordedChunks.length > 0 && (
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                                <Check size={12} /> Audio Recorded
                                            </span>
                                        )}
                                    </div>

                                    {/* File Upload */}
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                                        {selectedFile ? (
                                            <div className="text-center w-full">
                                                <FileAudio size={24} className="mx-auto text-primary-500 mb-2" />
                                                <p className="text-xs text-slate-600 truncate px-2">{selectedFile.name}</p>
                                                <button onClick={() => setSelectedFile(null)} className="text-xs text-red-500 hover:underline mt-1">Remove</button>
                                            </div>
                                        ) : (
                                            <>
                                                <input
                                                    type="file"
                                                    accept="audio/*,video/*"
                                                    onChange={handleFileSelect}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                                <Upload size={20} className="text-slate-400" />
                                                <span className="text-sm text-slate-500">Upload Recording</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* AI Actions */}
                                {selectedFile && (
                                    <div className="mt-4 flex justify-center">
                                        <button
                                            onClick={handleTranscribe}
                                            disabled={isTranscribing}
                                            className="btn btn-secondary btn-sm min-w-[160px] gap-2"
                                        >
                                            {isTranscribing ? <span className="loading loading-spinner loading-xs" /> : <FileText size={14} />}
                                            {isTranscribing ? 'Transcribing...' : (transcript ? 'Re-transcribe' : 'Transcribe Audio')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* TABS */}
                            <div className="flex border-b border-slate-200">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab('transcript')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transcript' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Transcript
                                </button>
                                <button
                                    onClick={() => setActiveTab('summary')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'summary' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Sparkles size={14} /> AI Summary
                                </button>
                            </div>

                            {/* TAB CONTENT */}
                            <div className="min-h-[200px]">
                                {activeTab === 'overview' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-2">Attendees</label>
                                            <div className="flex flex-wrap gap-2">
                                                {orgMembers.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => toggleAttendee(m.full_name)}
                                                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${meetingAttendees.includes(m.full_name)
                                                            ? 'bg-primary-50 border-primary-200 text-primary-700'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        {m.full_name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-2">Meeting Notes</label>
                                            <textarea
                                                className="input w-full min-h-[150px] font-sans"
                                                placeholder="Type your notes here..."
                                                value={meetingNotes}
                                                onChange={e => setMeetingNotes(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'transcript' && (
                                    <textarea
                                        className="input w-full min-h-[300px] font-sans text-sm leading-relaxed"
                                        placeholder="Transcript will appear here..."
                                        value={transcript}
                                        onChange={e => setTranscript(e.target.value)}
                                    />
                                )}
                                {activeTab === 'summary' && (
                                    <div className="flex flex-col gap-4 relative">
                                        <div className="flex justify-end mb-2">
                                            <button
                                                onClick={handleSummarize}
                                                disabled={isSummarizing || (!transcript && !meetingNotes)}
                                                className="btn btn-secondary btn-sm gap-2 text-primary-700 shadow-sm"
                                            >
                                                {isSummarizing ? <span className="loading loading-spinner loading-xs" /> : <Sparkles size={14} />}
                                                {isSummarizing ? 'Generating...' : (summary ? 'Regenerate Summary' : 'Generate AI Summary')}
                                            </button>
                                        </div>
                                        <textarea
                                            className="input w-full min-h-[300px] leading-relaxed"
                                            placeholder="AI summary will appear here..."
                                            value={summary}
                                            onChange={e => setSummary(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3 z-10 sticky bottom-0">
                            <button onClick={resetForm} className="btn btn-ghost text-slate-500">Cancel</button>
                            <button
                                onClick={saveMeeting}
                                disabled={isUploading || !meetingTitle}
                                className="btn btn-primary min-w-[120px] shadow-lg shadow-primary-500/20"
                            >
                                {isUploading ? <span className="loading loading-spinner loading-xs" /> : (
                                    <>
                                        <Save size={16} className="mr-2" /> Save Meeting
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : selectedMeeting ? (
                    /* DETAILS MODE */
                    <div className="flex flex-col h-full">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">{selectedMeeting.title}</h1>
                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                    <span className="flex items-center gap-1"><Clock size={14} /> {new Date(selectedMeeting.date).toLocaleString()}</span>
                                    {selectedMeeting.duration && <span className="bg-slate-200 px-2 py-0.5 rounded text-xs font-medium text-slate-700">{selectedMeeting.duration}</span>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {!selectedMeeting.recording && !selectedMeeting.transcript && (
                                    <button
                                        onClick={() => {
                                            setMeetingTitle(selectedMeeting.title);
                                            setMeetingNotes(selectedMeeting.notes || '');
                                            setMeetingAttendees(selectedMeeting.attendees || []);
                                            setIsCreating(true);
                                        }}
                                        className="btn btn-primary btn-sm flex items-center gap-2 mr-2"
                                    >
                                        <Mic size={16} /> Start Meeting
                                    </button>
                                )}
                                <button
                                    onClick={deleteCurrentMeeting}
                                    className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50"
                                    title="Delete Meeting"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={() => setSelectedMeeting(null)}
                                    className="btn btn-ghost btn-sm text-slate-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Audio Player Sticky Header */}
                        {audioUrl && (
                            <div className="px-6 py-3 bg-slate-100 border-b border-slate-200">
                                <audio controls className="w-full h-8">
                                    <source src={audioUrl} />
                                    Your browser does not support the audio element.
                                </audio>
                            </div>
                        )}

                        <div className="flex border-b border-slate-200 px-6 pt-2">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('transcript')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transcript' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Transcript
                            </button>
                            <button
                                onClick={() => setActiveTab('summary')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'summary' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Sparkles size={14} /> AI Summary
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    <div className="card p-4 bg-slate-50 border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Attendees</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedMeeting.attendees?.length > 0 ? (
                                                selectedMeeting.attendees.map((attendee, i) => (
                                                    <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-sm text-slate-600 shadow-sm">
                                                        {attendee}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-sm text-slate-400 italic">No attendees recorded</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Notes</h3>
                                        <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                                            {selectedMeeting.notes || <span className="text-slate-400 italic">No notes recorded.</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'transcript' && (
                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap font-mono">
                                        {selectedMeeting.transcript || <span className="text-slate-400 italic">No transcript available.</span>}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'summary' && (
                                <div className="bg-primary-50/50 p-6 rounded-lg border border-primary-100">
                                    <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap">
                                        {selectedMeeting.summary || <span className="text-slate-400 italic">No summary available.</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* EMPTY STATE */
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Bot size={64} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-slate-500">Select a meeting or start a new one.</p>
                        <p className="text-sm mt-2">View transcripts, AI summaries, and recordings.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="btn btn-primary mt-6"
                        >
                            Start New Meeting
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
