import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { internalServerErrorResponse } from '@/lib/api/security';

type AccessResult = {
    supabase: ReturnType<typeof createAdminClient>;
    userId: string;
} | {
    error: NextResponse;
};

function getBearerToken(authHeader: string | null): string | null {
    if (!authHeader) return null;
    const [scheme, token] = authHeader.trim().split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
    return token;
}

export async function requireProjectAccess(
    headers: Headers,
    projectId: string
): Promise<AccessResult> {
    const token = getBearerToken(headers.get('authorization'));
    if (!token) {
        return {
            error: NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
        };
    }

    const supabase = createAdminClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return { error: NextResponse.json({ error: 'Unauthorized user' }, { status: 401 }) };
    }

    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, org_id')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
    }

    const { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('org_id', project.org_id)
        .eq('user_id', user.id)
        .maybeSingle();

    if (membershipError) {
        return { error: internalServerErrorResponse() };
    }

    if (!membership) {
        return { error: NextResponse.json({ error: 'Forbidden: missing project membership' }, { status: 403 }) };
    }

    return { supabase, userId: user.id };
}
