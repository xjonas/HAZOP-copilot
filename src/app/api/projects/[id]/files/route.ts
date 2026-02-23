import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { requireProjectAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { projectFiles } from '@/lib/db/schema';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if ('error' in access) {
        return access.error;
    }

    try {
        const files = await getDb()
            .select()
            .from(projectFiles)
            .where(eq(projectFiles.projectId, id))
            .orderBy(asc(projectFiles.createdAt));

        return NextResponse.json({ files });
    } catch (error) {
        console.error('Failed to list project files', error);
        return internalServerErrorResponse();
    }
}

export async function POST(
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
        const [created] = await getDb()
            .insert(projectFiles)
            .values({
                projectId: id,
                fileName: body?.fileName,
                storagePath: body?.storagePath,
                mimeType: body?.mimeType ?? 'application/pdf',
                sizeBytes: typeof body?.sizeBytes === 'number' ? body.sizeBytes : null,
            })
            .returning();

        if (!created) {
            return internalServerErrorResponse();
        }

        return NextResponse.json({ file: created }, { status: 201 });
    } catch (error) {
        console.error('Failed to create project file', error);
        return internalServerErrorResponse();
    }
}
