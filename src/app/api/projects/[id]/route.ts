import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireProjectAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!csrfOriginValid(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if ('error' in access) {
        return access.error;
    }

    try {
        const body = await request.json();
        const [updated] = await getDb()
            .update(projects)
            .set({
                name: body?.name,
                description: body?.description,
                status: body?.status,
                processDescription: body?.processDescription,
                deadline: body?.deadline,
                location: body?.location,
                responsiblePerson: body?.responsiblePerson,
                progress: body?.progress,
                workflowStage: body?.workflowStage,
            })
            .where(eq(projects.id, id))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ project: updated });
    } catch (error) {
        console.error('Failed to update project', error);
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
    const access = await requireProjectAccess(request, id);
    if ('error' in access) {
        return access.error;
    }

    try {
        const deleted = await getDb()
            .delete(projects)
            .where(eq(projects.id, id))
            .returning({ id: projects.id });

        if (!deleted.length) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to delete project', error);
        return internalServerErrorResponse();
    }
}
