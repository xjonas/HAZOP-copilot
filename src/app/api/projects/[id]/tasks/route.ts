import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { requireProjectAccess } from '@/lib/api/access-control';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';

type TaskInput = {
    id?: string;
    taskType: 'object' | 'node';
    title: string;
    description?: string;
    status?: string;
    displayOrder?: number;
    operatingConditions?: string;
    position?: string;
    connections?: string;
    chemicals?: string;
    designIntent?: string;
    boundaries?: string;
    equipmentTags?: string;
};

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
        const taskType = request.nextUrl.searchParams.get('taskType');

        const rows = await getDb()
            .select()
            .from(tasks)
            .where(taskType ? and(eq(tasks.projectId, id), eq(tasks.taskType, taskType as 'object' | 'node')) : eq(tasks.projectId, id))
            .orderBy(asc(tasks.displayOrder));

        return NextResponse.json({ tasks: rows });
    } catch (error) {
        console.error('Failed to list tasks', error);
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
        const inputTasks: TaskInput[] = Array.isArray(body?.tasks) ? body.tasks : [];

        if (!inputTasks.length) {
            return NextResponse.json({ tasks: [] });
        }

        const upsertRows = inputTasks.map((item: TaskInput) => ({
            id: item.id,
            projectId: id,
            taskType: item.taskType,
            title: item.title,
            description: item.description ?? null,
            status: item.status ?? 'pending',
            displayOrder: typeof item.displayOrder === 'number' ? item.displayOrder : 0,
            operatingConditions: item.operatingConditions ?? null,
            position: item.position ?? null,
            connections: item.connections ?? null,
            chemicals: item.chemicals ?? null,
            designIntent: item.designIntent ?? null,
            boundaries: item.boundaries ?? null,
            equipmentTags: item.equipmentTags ?? null,
        }));

        const rows = await getDb()
            .insert(tasks)
            .values(upsertRows)
            .onConflictDoUpdate({
                target: tasks.id,
                set: {
                    title: sql`excluded.title`,
                    description: sql`excluded.description`,
                    status: sql`excluded.status`,
                    displayOrder: sql`excluded.display_order`,
                    operatingConditions: sql`excluded.operating_conditions`,
                    position: sql`excluded.position`,
                    connections: sql`excluded.connections`,
                    chemicals: sql`excluded.chemicals`,
                    designIntent: sql`excluded.design_intent`,
                    boundaries: sql`excluded.boundaries`,
                    equipmentTags: sql`excluded.equipment_tags`,
                },
            })
            .returning();

        return NextResponse.json({ tasks: rows });
    } catch (error) {
        console.error('Failed to upsert tasks', error);
        return internalServerErrorResponse();
    }
}
