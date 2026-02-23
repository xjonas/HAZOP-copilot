import { NextRequest, NextResponse } from 'next/server';
import { analyzeFile, type DetectedObject } from '@/lib/ai/services/pfd-analysis';
import { langfuse } from '@/lib/ai/langfuse';
import { requireProjectAccess } from '@/lib/api/access-control';
import { enforceRateLimit, internalServerErrorResponse } from '@/lib/api/security';
import { getDb } from '@/lib/db/client';
import { projectFiles, projects, tasks } from '@/lib/db/schema';
import { getObjectBuffer } from '@/lib/storage/s3';
import { and, eq, asc } from 'drizzle-orm';
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
        const limit = enforceRateLimit(`ai:detect-objects:${userId}`, {
            windowMs: 60_000,
            maxRequests: 10,
        });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Try again later.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
            );
        }

        // 2) Fetch PDF files for this project
        const db = getDb();

        const files = await db
            .select()
            .from(projectFiles)
            .where(eq(projectFiles.projectId, project_id))
            .orderBy(asc(projectFiles.createdAt));

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No PDF files found for this project' }, { status: 404 });
        }

        // 3) Process each PDF file using OCR + LLM
        let allDetectedObjects: DetectedObject[] = [];
        let totalLatency = 0;
        let lastModel = '';

        for (const file of files) {
            // Download file from S3
            let fileBuffer: Buffer;
            try {
                fileBuffer = await getObjectBuffer({
                    bucketType: 'pid',
                    key: file.storagePath,
                });
            } catch (downloadError) {
                console.error(`Failed to download file ${file.storagePath}:`, downloadError);
                continue;
            }

            // Determine mime type from extension
            const ext = file.fileName.split('.').pop()?.toLowerCase();
            let mimeType = 'application/pdf';
            if (ext === 'png') mimeType = 'image/png';
            if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            if (ext === 'webp') mimeType = 'image/webp';

            // Convert buffer to base64
            const base64File = fileBuffer.toString('base64');

            // Analyze using Dedalus Vision (OCR + LLM)
            // analyzeFile handles both PDF conversion and direct image processing
            const result = await analyzeFile(base64File, mimeType, {
                userId,
                projectId: project_id
            });

            allDetectedObjects = [...allDetectedObjects, ...result.objects];
            totalLatency += result.metrics.latencyMs;
            lastModel = result.model;
        }

        if (allDetectedObjects.length === 0) {
            return NextResponse.json({ error: 'Failed to detect objects from PDF(s)' }, { status: 500 });
        }

        // 4) Delete existing object tasks for this project (for rerun support)
        await db
            .delete(tasks)
            .where(and(eq(tasks.projectId, project_id), eq(tasks.taskType, 'object')));

        // 5) Insert detected objects as tasks
        // Recalculate display_order to be sequential across all files
        const taskRows = allDetectedObjects.map((obj, index) => ({
            projectId: project_id,
            taskType: 'object' as const,
            title: obj.title,
            description: obj.description,
            // Structured data fields
            position: obj.position,
            connections: obj.connections,
            operatingConditions: obj.operating_conditions,
            chemicals: obj.chemicals,

            status: 'pending',
            displayOrder: index + 1,
        }));

        const createdTasks = await db
            .insert(tasks)
            .values(taskRows)
            .returning();

        // 6) Update project workflow stage
        await db
            .update(projects)
            .set({
                workflowStage: 'objectReview',
                progress: 40,
            })
            .where(eq(projects.id, project_id));

        return NextResponse.json({
            success: true,
            objects: createdTasks,
            count: allDetectedObjects.length,
            model: lastModel,
            latencyMs: totalLatency,
        });

    } catch (error: unknown) {
        console.error('Object detection error:', error);
        return internalServerErrorResponse();
    } finally {
        await langfuse.flushAsync();
    }
}
