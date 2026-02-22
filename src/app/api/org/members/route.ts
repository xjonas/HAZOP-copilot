import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        // We initialize the admin client (which bypasses RLS securely on the server wrapper)
        const supabaseAdmin = createAdminClient();

        // Get Authorization header to extract the user's JWT
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        // Get user ID securely via user's JWT hitting our valid DB
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
        }

        // 1. Determine user's Org IDs
        const { data: orgData, error: orgError } = await supabaseAdmin
            .from('org_members')
            .select('org_id')
            .eq('user_id', user.id);

        if (orgError) {
            return NextResponse.json({ error: orgError.message }, { status: 400 });
        }

        const orgIds = orgData?.map(o => o.org_id) || [];
        if (!orgIds.length) {
            return NextResponse.json({ members: [] });
        }

        // 2. Safely grab all members logic from the same orgs (bypassing the strict public profile RLS)
        const { data: membersRaw, error: usersErr } = await supabaseAdmin
            .from('org_members')
            .select('user_id')
            .in('org_id', orgIds);

        if (usersErr) {
            return NextResponse.json({ error: usersErr.message }, { status: 400 });
        }

        const userIds = Array.from(new Set(membersRaw?.map(m => m.user_id) || []));
        if (!userIds.length) {
            return NextResponse.json({ members: [] });
        }

        const { data: profiles, error: profErr } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .in('id', userIds);

        if (profErr) {
            return NextResponse.json({ error: profErr.message }, { status: 400 });
        }

        return NextResponse.json({ members: profiles });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
