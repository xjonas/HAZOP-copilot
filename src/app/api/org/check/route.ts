import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { orgs } from '@/lib/db/schema';
import { ilike } from 'drizzle-orm';
import { z } from 'zod';

const orgCheckSchema = z.object({
    companyName: z.string().min(1, 'Company name is required')
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = orgCheckSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { companyName } = parsed.data;

        const [existingOrg] = await getDb()
            .select({ id: orgs.id })
            .from(orgs)
            .where(ilike(orgs.name, companyName))
            .limit(1);

        if (existingOrg) {
            return NextResponse.json({ exists: true });
        } else {
            return NextResponse.json({ exists: false }, { status: 404 });
        }

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
