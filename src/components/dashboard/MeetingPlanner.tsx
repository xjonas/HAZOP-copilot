'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Video, Clock, User, Users } from 'lucide-react';
import type { Project, Meeting, TeamMember } from '@/types';
import { useMeetings } from '@/hooks/useMeetings';
import { useTeam } from '@/hooks/useTeam';

interface MeetingPlannerProps {
    projects: Project[];
}

export function MeetingPlanner({ projects }: MeetingPlannerProps) {
    const { getAllMeetings, addMeeting } = useMeetings();
    const { getTeamMembers } = useTeam();

    // Extracted state for component
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [projectMembers, setProjectMembers] = useState<TeamMember[]>([]);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingNotes, setMeetingNotes] = useState('');
    const [meetingAttendees, setMeetingAttendees] = useState<string[]>([]);
    const [isScheduling, setIsScheduling] = useState(false);

    // Provide a dummy loading flag to prevent too many effects inside if not needed, 
    // or just assume we load initially.
    useEffect(() => {
        getAllMeetings().then(data => {
            const upcoming = data.filter(m => new Date(m.date) >= new Date());
            setMeetings(upcoming.slice(0, 5));
        }).catch(console.error);
    }, [getAllMeetings]);

    useEffect(() => {
        if (selectedProjectId) {
            getTeamMembers(selectedProjectId).then(setProjectMembers).catch(console.error);
        } else {
            setProjectMembers([]);
        }
        setMeetingAttendees([]);
    }, [selectedProjectId, getTeamMembers]);

    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning').slice(0, 5);

    const handleScheduleMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId || !meetingTitle || !meetingDate) return;
        setIsScheduling(true);
        try {
            const newM = await addMeeting({
                projectId: selectedProjectId,
                title: meetingTitle,
                date: new Date(meetingDate).toISOString(),
                notes: meetingNotes,
                attendees: meetingAttendees,
                recording: false,
                duration: "Scheduled"
            });
            setMeetings(prev => [...prev, newM].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5));
            setMeetingTitle('');
            setMeetingNotes('');
            setMeetingDate('');
            setMeetingAttendees([]);
            setSelectedProjectId('');
        } catch (err) {
            console.error(err);
            alert("Failed to schedule meeting.");
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
                    <Video size={18} className="text-primary-500" /> Plan Meeting
                </h2>
                <form onSubmit={handleScheduleMeeting} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Project</label>
                        <select required value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="input w-full text-sm">
                            <option value="">Select a project...</option>
                            {activeProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                            <input required type="text" className="input w-full " value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} placeholder="Kick-off Session" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Date & Time</label>
                            <input required type="datetime-local" className="input w-full " value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
                        </div>
                    </div>
                    {projectMembers.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">Attendees</label>
                            <div className="flex flex-wrap gap-2">
                                {projectMembers.map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setMeetingAttendees(prev => prev.includes(m.name) ? prev.filter(a => a !== m.name) : [...prev, m.name])}
                                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${meetingAttendees.includes(m.name)
                                            ? 'bg-primary-50 border-primary-200 text-primary-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <button type="submit" disabled={isScheduling || !selectedProjectId} className="btn btn-primary w-full shadow-sm">
                        {isScheduling ? 'Scheduling...' : 'Schedule Meeting'}
                    </button>
                </form>
            </div>

            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
                    <Users size={18} className="text-slate-500" /> Upcoming Meetings
                </h2>
                {meetings.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm italic">
                        No upcoming meetings scheduled.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {meetings.map(meeting => (
                            <div key={meeting.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 relative flex items-center justify-between group">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800">{meeting.title}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(meeting.date).toLocaleString()}</span>
                                        <span className="flex items-center gap-1"><User size={12} /> {meeting.attendees?.length || 0} Attending</span>
                                    </div>
                                </div>
                                <Link
                                    href={`/projects/${meeting.projectId}/meetings?meetingId=${meeting.id}`}
                                    className="btn btn-secondary text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    Attend
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
