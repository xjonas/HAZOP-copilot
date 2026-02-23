import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireProjectAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { meetings } from '@/lib/db/schema';
import { deleteObject } from '@/lib/storage/s3';

function parseMeetingDate(value: unknown): Date | null {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
}

async function loadMeeting(meetingId: string) {
    const [meeting] = await getDb()
        .select({
            id: meetings.id,
            projectId: meetings.projectId,
            recordingPath: meetings.recordingPath,
        })
        .from(meetings)
        .where(eq(meetings.id, meetingId))
        .limit(1);

    return meeting;
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!csrfOriginValid(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const { id } = await context.params;

    try {
        const meeting = await loadMeeting(id);
        if (!meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        const access = await requireProjectAccess(request, meeting.projectId);
        if ('error' in access) {
            return access.error;
        }

        const body = await request.json();
        const hasDate = Object.prototype.hasOwnProperty.call(body ?? {}, 'date');
        const parsedDate = parseMeetingDate(body?.date);
        if (hasDate && !parsedDate) {
            return NextResponse.json({ error: 'Invalid meeting date' }, { status: 400 });
        }
        const meetingDate: Date | undefined = hasDate ? parsedDate ?? undefined : undefined;

        const [updated] = await getDb()
            .update(meetings)
            .set({
                title: body?.title,
                date: meetingDate,
                attendees: Array.isArray(body?.attendees) ? body.attendees : undefined,
                notes: body?.notes,
                summary: body?.summary,
                transcript: body?.transcript,
                recording: typeof body?.recording === 'boolean' ? body.recording : undefined,
                recordingPath: body?.recordingPath,
                duration: body?.duration,
            })
            .where(eq(meetings.id, id))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        return NextResponse.json({ meeting: updated });
    } catch (error) {
        console.error('Failed to update meeting', error);
        return internalServerErrorResponse();
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!csrfOriginValid(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const { id } = await context.params;

    try {
        const meeting = await loadMeeting(id);
        if (!meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        const access = await requireProjectAccess(request, meeting.projectId);
        if ('error' in access) {
            return access.error;
        }

        if (meeting.recordingPath) {
            try {
                await deleteObject({
                    bucketType: 'meeting',
                    key: meeting.recordingPath,
                });
            } catch (storageError) {
                console.error('Failed to delete meeting recording', storageError);
            }
        }

        await getDb().delete(meetings).where(eq(meetings.id, id));
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to delete meeting', error);
        return internalServerErrorResponse();
    }
}
