import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
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

        // Check if user already has an org assignment in profiles
        const { data: profile, error: profErr } = await supabaseAdmin
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .single();

        if (profErr) {
            return NextResponse.json({ error: profErr.message }, { status: 400 });
        }

        // If they already possess an org_id, abort the auto-assignment
        if (profile.org_id) {
            return NextResponse.json({ message: 'User already assigned to an organization', org_id: profile.org_id });
        }

        // Read their company_name from metadata payload during signup
        const companyName = user.user_metadata?.company_name;
        if (!companyName) {
            return NextResponse.json({ message: 'No company_name present in metadata' });
        }

        // Search for existing org
        let targetOrgId: string;
        let isCreator = false;

        const { data: existingOrg, error: orgSearchErr } = await supabaseAdmin
            .from('orgs')
            .select('id')
            .eq('name', companyName)
            .single();

        if (orgSearchErr && orgSearchErr.code !== 'PGRST116') {
            return NextResponse.json({ error: orgSearchErr.message }, { status: 400 });
        }

        if (existingOrg) {
            targetOrgId = existingOrg.id;
        } else {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Insert into org_members (as member)
        const role = 'member';
        const { error: memberErr } = await supabaseAdmin
            .from('org_members')
            .insert({
                org_id: targetOrgId,
                user_id: user.id,
                role: role
            });

        if (memberErr) {
            // If they are somehow already a member, this handles the unique constraint gracefully
            if (memberErr.code !== '23505') {
                return NextResponse.json({ error: memberErr.message }, { status: 400 });
            }
        }

        // Finally, update the profiles.org_id field
        const { error: updateProfErr } = await supabaseAdmin
            .from('profiles')
            .update({ org_id: targetOrgId })
            .eq('id', user.id);

        if (updateProfErr) {
            return NextResponse.json({ error: updateProfErr.message }, { status: 400 });
        }

        return NextResponse.json({ message: 'Successfully assigned organization', org_id: targetOrgId });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
