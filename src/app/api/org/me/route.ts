import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const supabaseAdmin = createAdminClient();

        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
        }

        // 1. Determine user's Org IDs
        const { data: orgData, error: orgError } = await supabaseAdmin
            .from('org_members')
            .select('org_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (orgError && orgError.code !== 'PGRST116') { // Ignore zero rows error
            return NextResponse.json({ error: orgError.message }, { status: 400 });
        }

        if (!orgData?.org_id) {
            return NextResponse.json({ org_name: null });
        }

        // 2. Fetch Org Name
        const { data: orgDetails, error: detailsErr } = await supabaseAdmin
            .from('orgs')
            .select('name')
            .eq('id', orgData.org_id)
            .single();

        if (detailsErr) {
            return NextResponse.json({ error: detailsErr.message }, { status: 400 });
        }

        return NextResponse.json({ org_name: orgDetails.name });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
