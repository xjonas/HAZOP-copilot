import { NextRequest, NextResponse } from 'next/server';
import { getDedalusClient } from '@/lib/ai/dedalus-client';
import { withLangfuseDedalus, langfuse } from '@/lib/ai/langfuse';
import { requireProjectAccess } from '@/lib/api/access-control';
import { enforceRateLimit, internalServerErrorResponse } from '@/lib/api/security';
import { z } from 'zod';

const hazopSchema = z.object({
    project_id: z.string().uuid('Invalid project_id'),
    node_id: z.string().uuid('Invalid node_id')
});

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const body = await request.json();
        const parsed = hazopSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { project_id, node_id } = parsed.data;
        const access = await requireProjectAccess(request.headers, project_id);
        if ('error' in access) {
            return access.error;
        }

        const { supabase, userId } = access;
        const limit = enforceRateLimit(`ai:hazop-suggestions:${userId}`, {
            windowMs: 60_000,
            maxRequests: 10,
        });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Try again later.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
            );
        }

        const client = getDedalusClient();

        // Fetch the specific node
        const { data: node, error: nodeError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', node_id)
            .eq('project_id', project_id)
            .single();

        if (nodeError || !node) {
            return NextResponse.json({ error: 'Node not found' }, { status: 404 });
        }

        // Fetch all objects for context
        const { data: objects, error: objError } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', project_id)
            .eq('task_type', 'object');

        if (objError) throw objError;

        // Fetch meetings/transcripts for context
        const { data: meetings, error: meetingsError } = await supabase
            .from('meetings')
            .select('title, summary, transcript, notes')
            .eq('project_id', project_id);

        if (meetingsError) throw meetingsError;

        const inputContext = {
            node: {
                title: node.title,
                description: node.description,
                design_intent: node.design_intent,
                boundaries: node.boundaries,
                equipment_tags: node.equipment_tags,
                operating_conditions: node.operating_conditions
            },
            objects_count: objects?.length || 0,
            objects_summary: objects?.map(o => ({ title: o.title, conditions: o.operating_conditions })).slice(0, 10), // Limit payload size
            meetings_count: meetings?.length || 0,
            meetings_text: meetings?.map(m => `Title: ${m.title}\nSummary: ${m.summary}\nNotes: ${m.notes}`).join('\n\n')
        };

        const { data: aiRun, error: runError } = await supabase
            .from('ai_runs')
            .insert({
                project_id,
                triggered_by: userId,
                run_type: 'hazop_analysis',
                status: 'running',
                model: 'openai/gpt-5.2',
                input_context: inputContext,
                prompt_messages: null,
                raw_response: null,
            })
            .select()
            .single();

        if (runError) console.error('Failed to create ai_runs record:', runError);

        const prompt = `
        You are an expert Process Safety Engineer conducting a HAZOP study. Your task is to generate HAZOP analysis rows for the specific Node provided below.
        Use standard Guide Words (e.g., No, More, Less, As Well As, Part Of, Reverse, Other Than) and Parameters (e.g., Flow, Pressure, Temperature, Level).
        
        Generate 3 to 5 realistic and highly specific HAZOP deviations for this node, incorporating context from the project objects and meeting transcripts.

        NODE DETAILS:
        ${JSON.stringify(inputContext.node, null, 2)}

        PROJECT CONTEXT (Meeting Summaries & Notes):
        ${inputContext.meetings_text || "No meeting data available."}

        Return a JSON object with a "suggestions" array. Each suggestion should match this structure exactly:
        - guideWord: string (e.g., "More")
        - parameter: string (e.g., "Pressure")
        - deviation: string (e.g., "High Pressure")
        - causes: string
        - consequences: string
        - safeguards: string
        - recommendations: string
        - severity: number (1 to 5)
        - likelihood: number (1 to 5)

        Response Format:
        {
            "suggestions": [
                {
                    "guideWord": "...",
                    "parameter": "...",
                    "deviation": "...",
                    "causes": "...",
                    "consequences": "...",
                    "safeguards": "...",
                    "recommendations": "...",
                    "severity": 4,
                    "likelihood": 2
                }
            ]
        }
        `;

        if (aiRun) {
            await supabase.from('ai_runs').update({
                prompt_messages: [{ role: 'user', content: prompt }]
            }).eq('id', aiRun.id);
        }

        const completion = await withLangfuseDedalus({
            traceName: "HAZOP Suggestions",
            userId,
            projectId: project_id,
            model: "openai/gpt-5.2",
            input: { prompt, nodeTitle: inputContext.node.title },
            execute: async () => {
                const res = await client.chat.completions.create({
                    model: "openai/gpt-5.2",
                    messages: [
                        { role: "user", content: prompt }
                    ]
                });
                return {
                    result: res,
                    usage: res.usage,
                    rawResponse: res.choices[0].message.content
                };
            }
        });

        const rawContent = completion.choices[0].message.content;
        const jsonContent = rawContent?.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '') || '{}';

        let parsedResult;
        try {
            parsedResult = JSON.parse(jsonContent);
        } catch (e) {
            console.error("Failed to parse AI response:", rawContent);
            if (aiRun) {
                await supabase.from('ai_runs').update({
                    status: 'failed',
                    latency_ms: Date.now() - startTime,
                    model: 'openai/gpt-5.2',
                    total_tokens: completion.usage?.total_tokens,
                    prompt_tokens: completion.usage?.prompt_tokens,
                    completion_tokens: completion.usage?.completion_tokens,
                    raw_response: { raw: rawContent, error: "JSON Parse Error" },
                    error_message: "Failed to parse JSON response",
                    completed_at: new Date().toISOString(),
                }).eq('id', aiRun.id);
            }
            throw new Error("Invalid JSON response from AI");
        }

        const suggestions = parsedResult.suggestions || [];

        if (aiRun) {
            await supabase.from('ai_runs').update({
                status: 'completed',
                latency_ms: Date.now() - startTime,
                model: 'openai/gpt-5.2',
                total_tokens: completion.usage?.total_tokens,
                prompt_tokens: completion.usage?.prompt_tokens,
                completion_tokens: completion.usage?.completion_tokens,
                raw_response: { raw: rawContent, parsed: parsedResult },
                output_summary: `Generated ${suggestions.length} HAZOP suggestions`,
                completed_at: new Date().toISOString(),
            }).eq('id', aiRun.id);
        }

        return NextResponse.json({
            success: true,
            suggestions
        });

    } catch (error: unknown) {
        console.error('Hazop AI error:', error);
        return internalServerErrorResponse();
    } finally {
        await langfuse.flushAsync();
    }
}
