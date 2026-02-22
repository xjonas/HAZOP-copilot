import type { SupabaseClient } from '@supabase/supabase-js';

export async function getPrimaryOrgIdForUser(
    supabase: SupabaseClient,
    userId: string
): Promise<string> {
    const { data, error } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

    if (error || !data) {
        throw new Error('No org membership found');
    }

    return data.org_id as string;
}
