import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { requireOrgAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
    const access = await requireOrgAccess(request);
    if ('error' in access) {
        return access.error;
    }

    try {
        const projectRows = await getDb()
            .select()
            .from(projects)
            .where(eq(projects.orgId, access.orgId))
            .orderBy(desc(projects.createdAt));

        return NextResponse.json({ projects: projectRows });
    } catch (error) {
        console.error('Failed to list projects', error);
        return internalServerErrorResponse();
    }
}

export async function POST(request: NextRequest) {
    if (!csrfOriginValid(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const access = await requireOrgAccess(request);
    if ('error' in access) {
        return access.error;
    }

    try {
        const body = await request.json();
        const [created] = await getDb()
            .insert(projects)
            .values({
                orgId: access.orgId,
                name: body?.name,
                description: body?.description ?? null,
                status: body?.status ?? 'planning',
                processDescription: body?.processDescription ?? null,
                deadline: body?.deadline ?? null,
                location: body?.location ?? null,
                responsiblePerson: body?.responsiblePerson ?? null,
                progress: typeof body?.progress === 'number' ? body.progress : 0,
                workflowStage: body?.workflowStage ?? null,
            })
            .returning();

        if (!created) {
            return internalServerErrorResponse();
        }

        return NextResponse.json({ project: created }, { status: 201 });
    } catch (error) {
        console.error('Failed to create project', error);
        return internalServerErrorResponse();
    }
}
