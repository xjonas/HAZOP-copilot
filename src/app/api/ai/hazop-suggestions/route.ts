import { NextRequest, NextResponse } from 'next/server';
import { getDedalusClient } from '@/lib/ai/dedalus-client';
import { withLangfuseDedalus, langfuse } from '@/lib/ai/langfuse';
import { requireProjectAccess } from '@/lib/api/access-control';
import { enforceRateLimit, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { meetings, tasks } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const hazopSchema = z.object({
    project_id: z.string().uuid('Invalid project_id'),
    node_id: z.string().uuid('Invalid node_id')
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = hazopSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { project_id, node_id } = parsed.data;
        const access = await requireProjectAccess(request, project_id);
        if ('error' in access) {
            return access.error;
        }

        const { userId } = access;
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
        const db = getDb();

        const [node] = await db
            .select()
            .from(tasks)
            .where(and(eq(tasks.id, node_id), eq(tasks.projectId, project_id), eq(tasks.taskType, 'node')))
            .limit(1);

        if (!node) {
            return NextResponse.json({ error: 'Node not found' }, { status: 404 });
        }

        // Fetch all objects for context
        const objects = await db
            .select()
            .from(tasks)
            .where(and(eq(tasks.projectId, project_id), eq(tasks.taskType, 'object')));

        // Fetch meetings/transcripts for context
        const meetingsRows = await db
            .select({ title: meetings.title, summary: meetings.summary, transcript: meetings.transcript, notes: meetings.notes })
            .from(meetings)
            .where(eq(meetings.projectId, project_id));

        const inputContext = {
            node: {
                title: node.title,
                description: node.description,
                design_intent: node.designIntent,
                boundaries: node.boundaries,
                equipment_tags: node.equipmentTags,
                operating_conditions: node.operatingConditions
            },
            objects_count: objects?.length || 0,
            objects_summary: objects?.map(o => ({ title: o.title, conditions: o.operatingConditions })).slice(0, 10), // Limit payload size
            meetings_count: meetingsRows?.length || 0,
            meetings_text: meetingsRows?.map(m => `Title: ${m.title}\nSummary: ${m.summary}\nNotes: ${m.notes}`).join('\n\n')
        };

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
            throw new Error("Invalid JSON response from AI");
        }

        const suggestions = parsedResult.suggestions || [];

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
