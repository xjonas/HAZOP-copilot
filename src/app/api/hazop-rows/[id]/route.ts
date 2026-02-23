import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireTaskAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { hazopRows } from '@/lib/db/schema';

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!csrfOriginValid(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const { id } = await context.params;

    try {
        const [row] = await getDb()
            .select({ nodeTaskId: hazopRows.nodeTaskId })
            .from(hazopRows)
            .where(eq(hazopRows.id, id))
            .limit(1);

        if (!row) {
            return NextResponse.json({ error: 'HAZOP row not found' }, { status: 404 });
        }

        const access = await requireTaskAccess(request, row.nodeTaskId);
        if ('error' in access) {
            return access.error;
        }

        await getDb().delete(hazopRows).where(eq(hazopRows.id, id));
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to delete HAZOP row', error);
        return internalServerErrorResponse();
    }
}
