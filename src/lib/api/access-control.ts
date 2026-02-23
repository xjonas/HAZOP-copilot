import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { internalServerErrorResponse } from '@/lib/api/security';
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cognito';
import { getDb } from '@/lib/db/client';
import { projects, tasks, users } from '@/lib/db/schema';
import type { NextRequest } from 'next/server';

type AccessResult = {
    userId: string;
    orgId: string;
} | {
    error: NextResponse;
};

type TaskAccessResult = {
    userId: string;
    projectId: string;
    orgId: string;
} | {
    error: NextResponse;
};

type OrgAccessResult = {
    userId: string;
    orgId: string;
} | {
    error: NextResponse;
};

export async function requireOrgAccess(
    request: NextRequest,
): Promise<OrgAccessResult> {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
        return {
            error: NextResponse.json({ error: 'Unauthorized user' }, { status: 401 })
        };
    }

    try {
        const db = getDb();
        const [userRow] = await db
            .select({ id: users.id, orgId: users.orgId })
            .from(users)
            .where(eq(users.cognitoSub, user.sub))
            .limit(1);

        if (!userRow) {
            return { error: NextResponse.json({ error: 'Forbidden: user is not provisioned' }, { status: 403 }) };
        }

        if (!userRow.orgId) {
            return { error: NextResponse.json({ error: 'Forbidden: missing organization membership' }, { status: 403 }) };
        }

        return { userId: userRow.id, orgId: userRow.orgId };
    } catch (error) {
        console.error('requireOrgAccess failed', error);
        return { error: internalServerErrorResponse() };
    }
}

export async function requireProjectAccess(
    request: NextRequest,
    projectId: string
): Promise<AccessResult> {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
        return {
            error: NextResponse.json({ error: 'Unauthorized user' }, { status: 401 })
        };
    }

    try {
        const db = getDb();
        const [userRow] = await db
            .select({ id: users.id, orgId: users.orgId })
            .from(users)
            .where(eq(users.cognitoSub, user.sub))
            .limit(1);

        if (!userRow) {
            return { error: NextResponse.json({ error: 'Forbidden: user is not provisioned' }, { status: 403 }) };
        }

        if (!userRow.orgId) {
            return { error: NextResponse.json({ error: 'Forbidden: missing project membership' }, { status: 403 }) };
        }

        const [projectRow] = await db
            .select({ id: projects.id })
            .from(projects)
            .where(and(eq(projects.id, projectId), eq(projects.orgId, userRow.orgId)))
            .limit(1);

        if (!projectRow) {
            return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
        }

        return { userId: userRow.id, orgId: userRow.orgId };
    } catch (error) {
        console.error('requireProjectAccess failed', error);
        return { error: internalServerErrorResponse() };
    }
}

export async function requireTaskAccess(
    request: NextRequest,
    taskId: string
): Promise<TaskAccessResult> {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
        return {
            error: NextResponse.json({ error: 'Unauthorized user' }, { status: 401 })
        };
    }

    try {
        const db = getDb();
        const [userRow] = await db
            .select({ id: users.id, orgId: users.orgId })
            .from(users)
            .where(eq(users.cognitoSub, user.sub))
            .limit(1);

        if (!userRow) {
            return { error: NextResponse.json({ error: 'Forbidden: user is not provisioned' }, { status: 403 }) };
        }

        if (!userRow.orgId) {
            return { error: NextResponse.json({ error: 'Forbidden: missing task membership' }, { status: 403 }) };
        }

        const [taskRow] = await db
            .select({ projectId: tasks.projectId })
            .from(tasks)
            .innerJoin(projects, eq(tasks.projectId, projects.id))
            .where(and(eq(tasks.id, taskId), eq(projects.orgId, userRow.orgId)))
            .limit(1);

        if (!taskRow) {
            return { error: NextResponse.json({ error: 'Task not found' }, { status: 404 }) };
        }

        return { userId: userRow.id, projectId: taskRow.projectId, orgId: userRow.orgId };
    } catch (error) {
        console.error('requireTaskAccess failed', error);
        return { error: internalServerErrorResponse() };
    }
}
