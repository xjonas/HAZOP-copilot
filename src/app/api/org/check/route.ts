import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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

        const supabaseAdmin = createAdminClient();

        const { data: existingOrg, error: orgSearchErr } = await supabaseAdmin
            .from('orgs')
            .select('id')
            .ilike('name', companyName)
            .single();

        if (orgSearchErr && orgSearchErr.code !== 'PGRST116') {
            return NextResponse.json({ error: orgSearchErr.message }, { status: 400 });
        }

        if (existingOrg) {
            return NextResponse.json({ exists: true });
        } else {
            return NextResponse.json({ exists: false }, { status: 404 });
        }

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
