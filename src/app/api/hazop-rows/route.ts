import { NextRequest, NextResponse } from 'next/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { requireTaskAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { hazopRows } from '@/lib/db/schema';

type HazopRowInput = {
    id?: string;
    nodeTaskId: string;
    guideWord?: string;
    parameter?: string;
    deviation?: string;
    causes?: string;
    consequences?: string;
    safeguards?: string;
    recommendations?: string;
    severity?: number;
    likelihood?: number;
    displayOrder?: number;
};

export async function GET(request: NextRequest) {
    const nodeTaskId = request.nextUrl.searchParams.get('nodeTaskId');
    if (!nodeTaskId) {
        return NextResponse.json({ error: 'nodeTaskId is required' }, { status: 400 });
    }

    const access = await requireTaskAccess(request, nodeTaskId);
    if ('error' in access) {
        return access.error;
    }

    try {
        const rows = await getDb()
            .select()
            .from(hazopRows)
            .where(eq(hazopRows.nodeTaskId, nodeTaskId))
            .orderBy(asc(hazopRows.displayOrder));

        return NextResponse.json({ rows });
    } catch (error) {
        console.error('Failed to list HAZOP rows', error);
        return internalServerErrorResponse();
    }
}

export async function POST(request: NextRequest) {
    if (!csrfOriginValid(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const rows: HazopRowInput[] = Array.isArray(body?.rows) ? body.rows : [];

        if (!rows.length) {
            return NextResponse.json({ rows: [] });
        }

        const nodeTaskIds = Array.from(new Set(rows.map((row) => row.nodeTaskId).filter((value): value is string => typeof value === 'string' && value.length > 0)));
        for (const nodeTaskId of nodeTaskIds) {
            const access = await requireTaskAccess(request, nodeTaskId);
            if ('error' in access) {
                return access.error;
            }
        }

        const upsertRows = rows.map((row: HazopRowInput) => ({
            id: row.id,
            nodeTaskId: row.nodeTaskId,
            guideWord: row.guideWord ?? '',
            parameter: row.parameter ?? '',
            deviation: row.deviation ?? '',
            causes: row.causes ?? '',
            consequences: row.consequences ?? '',
            safeguards: row.safeguards ?? '',
            recommendations: row.recommendations ?? '',
            severity: typeof row.severity === 'number' ? row.severity : 1,
            likelihood: typeof row.likelihood === 'number' ? row.likelihood : 1,
            displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : 0,
        }));

        const ids = upsertRows
            .map((row) => row.id)
            .filter((value): value is string => typeof value === 'string' && value.length > 0);

        await getDb()
            .insert(hazopRows)
            .values(upsertRows)
            .onConflictDoUpdate({
                target: hazopRows.id,
                set: {
                    guideWord: sql`excluded.guide_word`,
                    parameter: sql`excluded.parameter`,
                    deviation: sql`excluded.deviation`,
                    causes: sql`excluded.causes`,
                    consequences: sql`excluded.consequences`,
                    safeguards: sql`excluded.safeguards`,
                    recommendations: sql`excluded.recommendations`,
                    severity: sql`excluded.severity`,
                    likelihood: sql`excluded.likelihood`,
                    displayOrder: sql`excluded.display_order`,
                },
            });

        const savedRows = ids.length
            ? await getDb().select().from(hazopRows).where(inArray(hazopRows.id, ids))
            : [];

        return NextResponse.json({ rows: savedRows });
    } catch (error) {
        console.error('Failed to upsert HAZOP rows', error);
        return internalServerErrorResponse();
    }
}
