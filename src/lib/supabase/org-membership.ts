import type { SupabaseClient } from '@supabase/supabase-js';

export async function getPrimaryOrgIdForUser(
    supabase: SupabaseClient,
    userId: string
): Promise<string> {
    const userLookup = await supabase
        .from('users')
        .select('org_id')
        .eq('cognito_sub', userId)
        .limit(1)
        .maybeSingle();

    if (userLookup.error) {
        throw new Error(userLookup.error.message || 'Failed to load user organization');
    }

    if (!userLookup.data?.org_id) {
        throw new Error('No organization assigned to user');
    }

    return userLookup.data.org_id as string;
}

export async function resolveInternalUserIdForSubject(
    supabase: SupabaseClient,
    params: {
        subject: string
        email?: string | null
        fullName?: string | null
    }
): Promise<string> {
    const subject = params.subject;

    const byCognito = await supabase
        .from('users')
        .select('id')
        .eq('cognito_sub', subject)
        .limit(1)
        .maybeSingle();

    if (byCognito.error) {
        throw new Error(byCognito.error.message || 'Failed to resolve user by Cognito subject');
    }

    if (byCognito.data?.id) {
        return byCognito.data.id as string;
    }

    const fallbackEmail = params.email || `${subject}@mvp.local`;
    const createResult = await supabase
        .from('users')
        .insert({
            cognito_sub: subject,
            email: fallbackEmail,
            full_name: params.fullName || null,
        })
        .select('id')
        .single();

    if (createResult.error || !createResult.data?.id) {
        if (createResult.error?.code !== '23505') {
            throw new Error(createResult.error?.message || 'Failed to create user record');
        }

        const retry = await supabase
            .from('users')
            .select('id')
            .eq('cognito_sub', subject)
            .limit(1)
            .maybeSingle();

        if (retry.error) {
            throw new Error(retry.error.message || 'Failed to resolve internal user id');
        }

        if (!retry.data?.id) {
            throw new Error('Failed to resolve internal user id');
        }

        return retry.data.id as string;
    }

    return createResult.data.id as string;
}
