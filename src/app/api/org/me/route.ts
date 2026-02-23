import { NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cognito';
import { getDb } from '@/lib/db/client';
import { orgs, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUserFromRequest(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
        }

        const db = getDb();

        const [userRow] = await db
            .select({ orgId: users.orgId })
            .from(users)
            .where(eq(users.cognitoSub, user.sub))
            .limit(1);

        if (!userRow?.orgId) {
            return NextResponse.json({ org_name: null });
        }

        const [orgDetails] = await db
            .select({ name: orgs.name })
            .from(orgs)
            .where(eq(orgs.id, userRow.orgId))
            .limit(1);

        return NextResponse.json({ org_name: orgDetails?.name ?? null });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
