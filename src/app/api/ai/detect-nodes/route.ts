import { NextRequest, NextResponse } from 'next/server';
import { getDedalusClient } from '@/lib/ai/dedalus-client';
import { withLangfuseDedalus, langfuse } from '@/lib/ai/langfuse';
import { requireProjectAccess } from '@/lib/api/access-control';
import { enforceRateLimit, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { projects, tasks } from '@/lib/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

const detectSchema = z.object({
    project_id: z.string().uuid('Invalid project_id')
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = detectSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { project_id } = parsed.data;
        const access = await requireProjectAccess(request, project_id);
        if ('error' in access) {
            return access.error;
        }

        const { userId } = access;
        const limit = enforceRateLimit(`ai:detect-nodes:${userId}`, {
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

        const db = getDb();

        const objects = await db
            .select()
            .from(tasks)
            .where(and(eq(tasks.projectId, project_id), eq(tasks.taskType, 'object')))
            .orderBy(asc(tasks.displayOrder));

        if (!objects || objects.length === 0) {
            return NextResponse.json({ error: 'No objects found. Run Object Detection first.' }, { status: 400 });
        }

        const inputContext = {
            object_count: objects.length,
            objects: objects.map(o => ({
                id: o.id,
                title: o.title,
                description: o.description,
                position: o.position,
                connections: o.connections,
                chemicals: o.chemicals,
                operating_conditions: o.operatingConditions
            }))
        };

        const prompt = `
        You are an expert Process Safety Engineer conducting a HAZOP study. Your task is to define the "Nodes" for the study based on the detected equipment/objects provided below.

        Start by first defining for yourself how Node definition is currently being done in HAZOP in real life (e.g., splitting by major vessels, enclosing lines between vessels, grouping functional systems). 
        Then, applying these best practices, group the provided objects into logical HAZOP Nodes.
        
        - A Node should represent a section of the process with defined boundaries (e.g., "Feed Line to Reactor", "Reactor R-101", "Distillation Column Overhead").
        - Every object provided should ideally belong to a node, or be excluded if it's irrelevant (e.g., utility reference).
        - Aggregation is good: A pump, its suction line, and discharge line up to the control valve might be one node.

        Here are the detected objects:
        ${JSON.stringify(inputContext.objects, null, 2)}

        Return a JSON object with a "nodes" array. Each node should have:
        - title: Short descriptive title (e.g. "Node 1: Reactor Feed")
        - description: General description of the node.
        - design_intent: The intended function or purpose of this node (e.g., "Transfer feed from tank to reactor at controlled rate").
        - boundaries: Explicit start and end points of the node (e.g., "From T-100 outlet to R-101 inlet").
        - equipment_tags: List of main equipment identifiers in this node (e.g., "R-101, P-102").
        - operating_conditions: Aggregate the temperature, pressure, flow, etc. from the included objects into a summary string (e.g. "50C, 2 bar").
        - chemicals: Extract and aggregate all chemicals running through the included objects into a list (e.g. "Benzene, Toluene").
        - objects: A comma separated string of the names/titles of the included objects (e.g. "R-101, P-102").
        - included_object_ids: Array of object IDs that belong to this node.

        Response Format:
        {
            "nodes": [
                { 
                    "title": "...", 
                    "description": "...", 
                    "design_intent": "...",
                    "boundaries": "...",
                    "equipment_tags": "...",
                    "operating_conditions": "...",
                    "chemicals": "...",
                    "objects": "...",
                    "included_object_ids": ["..."] 
                }
            ]
        }
        `;

        const completion = await withLangfuseDedalus({
            traceName: "Node Detection",
            userId,
            projectId: project_id,
            model: "openai/gpt-5.2",
            input: { prompt, objectsCount: inputContext.object_count },
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

        const nodes = parsedResult.nodes || [];

        await db
            .delete(tasks)
            .where(and(eq(tasks.projectId, project_id), eq(tasks.taskType, 'node')));

        const nodeRows = nodes.map((node: any, index: number) => ({
            projectId: project_id,
            taskType: 'node' as const,
            title: node.title,
            description: node.description + (node.included_object_ids?.length ? `\n\nIncludes: ${node.included_object_ids.length} objects` : ''),
            designIntent: node.design_intent,
            boundaries: node.boundaries,
            equipmentTags: node.equipment_tags,
            operatingConditions: node.operating_conditions,
            chemicals: node.chemicals,
            status: 'pending',
            displayOrder: index + 1,
        }));

        const createdNodes = await db
            .insert(tasks)
            .values(nodeRows)
            .returning();

        await db
            .update(projects)
            .set({
                workflowStage: 'nodeReview',
                progress: 60,
            })
            .where(eq(projects.id, project_id));

        return NextResponse.json({
            success: true,
            nodes: createdNodes,
            count: createdNodes?.length
        });

    } catch (error: unknown) {
        console.error('Node detection error:', error);
        return internalServerErrorResponse();
    } finally {
        await langfuse.flushAsync();
    }
}
