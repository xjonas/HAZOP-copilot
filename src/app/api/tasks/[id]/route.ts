import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { NextRequest, NextResponse } from 'next/server';
import { requireTaskAccess } from '@/lib/api/access-control';
import { getDb } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        if (!csrfOriginValid(request)) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        }

        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }

        const access = await requireTaskAccess(request, id);
        if ('error' in access) {
            return access.error;
        }

        const body = await request.json();
        const [updated] = await getDb()
            .update(tasks)
            .set({
                title: body?.title,
                description: body?.description,
                status: body?.status,
                displayOrder: body?.displayOrder,
                operatingConditions: body?.operatingConditions,
                position: body?.position,
                connections: body?.connections,
                chemicals: body?.chemicals,
                designIntent: body?.designIntent,
                boundaries: body?.boundaries,
                equipmentTags: body?.equipmentTags,
            })
            .where(eq(tasks.id, id))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ task: updated });
    } catch (error) {
        console.error('Unexpected error:', error);
        return internalServerErrorResponse();
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        if (!csrfOriginValid(request)) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        }

        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }

        const access = await requireTaskAccess(request, id);
        if ('error' in access) {
            return access.error;
        }

        const deletedRows = await getDb()
            .delete(tasks)
            .where(eq(tasks.id, id))
            .returning({ id: tasks.id });

        if (!deletedRows.length) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        if (!deletedRows[0]?.id) {
            return internalServerErrorResponse();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return internalServerErrorResponse();
    }
}
