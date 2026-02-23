import { NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cognito';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

function toDisplayName(fullName: string | null, email: string | null): string {
    if (fullName && fullName.trim()) {
        return fullName.trim();
    }

    if (email && email.trim()) {
        const localPart = email.split('@')[0] || '';
        const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
        if (cleaned) {
            return cleaned
                .split(/\s+/)
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(' ');
        }
    }

    return 'Team Member';
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUserFromRequest(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
        }

        const db = getDb();

        const [requester] = await db
            .select({ orgId: users.orgId })
            .from(users)
            .where(eq(users.cognitoSub, user.sub))
            .limit(1);

        const orgId = requester?.orgId;
        if (!orgId) {
            return NextResponse.json({ members: [] });
        }

        const membersRaw = await db
            .select({ id: users.id, fullName: users.fullName, email: users.email })
            .from(users)
            .where(eq(users.orgId, orgId))
            .orderBy(asc(users.fullName));

        const members = membersRaw.map((member) => {
            return {
                id: member.id,
                full_name: toDisplayName(member.fullName, member.email),
            };
        });

        return NextResponse.json({ members });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
