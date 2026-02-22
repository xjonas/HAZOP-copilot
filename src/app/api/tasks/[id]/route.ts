import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        if (!csrfOriginValid(request)) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        }

        const supabase = await createClient();
        const admin = createAdminClient();
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }

        // Verify user session or RLS
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: task, error: taskError } = await admin
            .from('tasks')
            .select('id, project_id')
            .eq('id', id)
            .single();

        if (taskError || !task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const { data: project, error: projectError } = await admin
            .from('projects')
            .select('org_id')
            .eq('id', task.project_id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { data: membership, error: membershipError } = await admin
            .from('org_members')
            .select('org_id')
            .eq('org_id', project.org_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (membershipError) {
            console.error('Error checking membership:', membershipError);
            return internalServerErrorResponse();
        }

        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { error } = await admin
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting task:', error);
            return internalServerErrorResponse();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unexpected error:', error);
        return internalServerErrorResponse();
    }
}
