import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { requireOrgAccess, requireProjectAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { meetings, projects } from '@/lib/db/schema';

function parseMeetingDate(value: unknown): Date | null {
    if (!value) {
        return new Date();
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

export async function GET(request: NextRequest) {
    const projectId = request.nextUrl.searchParams.get('projectId');

    if (projectId) {
        const access = await requireProjectAccess(request, projectId);
        if ('error' in access) {
            return access.error;
        }

        try {
            const rows = await getDb()
                .select()
                .from(meetings)
                .where(eq(meetings.projectId, projectId))
                .orderBy(desc(meetings.date));

            return NextResponse.json({ meetings: rows });
        } catch (error) {
            console.error('Failed to list project meetings', error);
            return internalServerErrorResponse();
        }
    }

    const access = await requireOrgAccess(request);
    if ('error' in access) {
        return access.error;
    }

    try {
        const projectRows = await getDb()
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.orgId, access.orgId));

        if (!projectRows.length) {
            return NextResponse.json({ meetings: [] });
        }

        const projectIds = projectRows.map((project) => project.id);
        const rows = await getDb()
            .select()
            .from(meetings)
            .where(inArray(meetings.projectId, projectIds))
            .orderBy(asc(meetings.date));

        return NextResponse.json({ meetings: rows });
    } catch (error) {
        console.error('Failed to list org meetings', error);
        return internalServerErrorResponse();
    }
}

export async function POST(request: NextRequest) {
    if (!csrfOriginValid(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const projectId = body?.projectId as string | undefined;

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const access = await requireProjectAccess(request, projectId);
        if ('error' in access) {
            return access.error;
        }

        const meetingDate = parseMeetingDate(body?.date);
        if (!meetingDate) {
            return NextResponse.json({ error: 'Invalid meeting date' }, { status: 400 });
        }

        const [created] = await getDb()
            .insert(meetings)
            .values({
                projectId,
                title: body?.title,
                date: meetingDate,
                attendees: Array.isArray(body?.attendees) ? body.attendees : [],
                notes: body?.notes ?? '',
                summary: body?.summary ?? null,
                transcript: body?.transcript ?? null,
                recording: Boolean(body?.recording),
                recordingPath: body?.recordingPath ?? null,
                duration: body?.duration ?? null,
            })
            .returning();

        if (!created) {
            return internalServerErrorResponse();
        }

        return NextResponse.json({ meeting: created }, { status: 201 });
    } catch (error) {
        console.error('Failed to create meeting', error);
        return internalServerErrorResponse();
    }
}
