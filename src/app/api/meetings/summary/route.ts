import { NextRequest, NextResponse } from 'next/server';
import { withLangfuseFetch, langfuse } from '@/lib/ai/langfuse';
import { requireProjectAccess } from '@/lib/api/access-control';
import { createAdminClient } from '@/lib/supabase/server';
import { enforceRateLimit, internalServerErrorResponse } from '@/lib/api/security';
import { z } from 'zod';

const summarySchema = z.object({
    projectId: z.string().uuid('Invalid projectId'),
    transcript: z.string().optional(),
    notes: z.string().optional()
}).refine(data => data.transcript || data.notes, {
    message: 'Transcript or notes required'
});

export async function POST(req: NextRequest) {
    let aiRun: any = null;
    const startTime = Date.now();

    try {
        const body = await req.json();
        const parsed = summarySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { transcript, notes, projectId } = parsed.data;
        const access = await requireProjectAccess(req.headers, projectId);
        if ('error' in access) {
            return access.error;
        }

        const apiKey = process.env.DEDALUS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Dedalus API key not configured' }, { status: 500 });
        }

        const { supabase, userId } = access;
        const limit = enforceRateLimit(`ai:meeting-summary:${userId}`, {
            windowMs: 60_000,
            maxRequests: 10,
        });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Try again later.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
            );
        }

        const prompt = `
You are a helpful AI assistant that summarizes meetings.
Please provide a structured summary of the following meeting transcript and notes.
The summary should include:
- TL;DR (Executive Summary)
- Key Points (Bulleted list)
- Action Items / Todos (with assignees if mentioned)
- Decisions Made

Structure the output in plain text (no markdown formatting).

Transcript:
${transcript || 'N/A'}

Notes:
${notes || 'N/A'}
`;

        // Create AI run record
        const { data: newAiRun, error: runError } = await supabase
            .from('ai_runs')
            .insert({
                project_id: projectId,
                triggered_by: userId,
                run_type: 'meeting_summary', // Ensure this value is allowed in constraints or 'other'
                status: 'running',
                model: 'openai/gpt-4o',
                provider: 'dedalus',
                input_context: { type: 'meeting_summary' },
                prompt_messages: [{ role: 'user', content: prompt }]
            })
            .select()
            .single();

        if (runError) {
            console.error('Failed to create ai_run:', runError);
        } else {
            aiRun = newAiRun;
        }

        console.log('Sending request to Dedalus API...');

        let data;
        try {
            data = await withLangfuseFetch({
                traceName: "Meeting Summary",
                userId,
                projectId,
                model: 'openai/gpt-4o',
                input: { prompt, notesCount: notes?.length || 0, transcriptLength: transcript?.length || 0 },
                execute: async () => {
                    const response = await fetch('https://api.dedaluslabs.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: 'openai/gpt-4o',
                            messages: [
                                { role: 'system', content: 'You are a helpful assistant.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: 0.7,
                        }),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Dedalus Chat API Error:', response.status, errorText);
                        throw new Error(`API Error ${response.status}: ${errorText}`);
                    }

                    const resData = await response.json();
                    return {
                        result: resData,
                        usage: resData.usage,
                        rawResponse: resData.choices?.[0]?.message?.content
                    };
                }
            });
        } catch (fetchError: any) {
            if (aiRun) {
                await supabase.from('ai_runs').update({
                    status: 'failed',
                    error_message: `Fetch error: ${fetchError.message}`,
                    completed_at: new Date().toISOString(),
                    latency_ms: Date.now() - startTime
                }).eq('id', aiRun.id);
            }
            return NextResponse.json({ error: 'Failed to generate meeting summary' }, { status: 500 });
        }

        const summary = data.choices?.[0]?.message?.content || 'No summary generated.';

        // Update run as completed
        if (aiRun) {
            await supabase.from('ai_runs').update({
                status: 'completed',
                output_summary: summary.substring(0, 500) + (summary.length > 500 ? '...' : ''),
                raw_response: data,
                prompt_tokens: data.usage?.prompt_tokens,
                completion_tokens: data.usage?.completion_tokens,
                total_tokens: data.usage?.total_tokens,
                completed_at: new Date().toISOString(),
                latency_ms: Date.now() - startTime
            }).eq('id', aiRun.id);
        }

        return NextResponse.json({ summary });

    } catch (error: any) {
        console.error('Summary generation error:', error);

        // Update aiRun as failed if it was created
        if (aiRun) {
            const supabase = createAdminClient();
            await supabase.from('ai_runs').update({
                status: 'failed',
                error_message: error.message || 'Unknown internal server error',
                completed_at: new Date().toISOString(),
                latency_ms: Date.now() - startTime
            }).eq('id', aiRun.id);
        }

        return internalServerErrorResponse();
    } finally {
        await langfuse.flushAsync();
    }
}
