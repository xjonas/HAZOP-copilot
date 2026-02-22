import { NextRequest, NextResponse } from 'next/server';
import { analyzeFile, type DetectedObject } from '@/lib/ai/services/pfd-analysis';
import { langfuse } from '@/lib/ai/langfuse';
import { requireProjectAccess } from '@/lib/api/access-control';
import { enforceRateLimit, internalServerErrorResponse } from '@/lib/api/security';
import { z } from 'zod';

const detectSchema = z.object({
    project_id: z.string().uuid('Invalid project_id')
});

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const body = await request.json();
        const parsed = detectSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { project_id } = parsed.data;
        const access = await requireProjectAccess(request.headers, project_id);
        if ('error' in access) {
            return access.error;
        }

        const { supabase, userId } = access;
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
        const { data: files, error: filesError } = await supabase
            .from('project_files')
            .select('*')
            .eq('project_id', project_id)
            .order('created_at');

        if (filesError) throw filesError;
        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No PDF files found for this project' }, { status: 404 });
        }

        // 3) Create an ai_runs record with status 'running' (Aligned Schema)
        const { data: aiRun, error: runError } = await supabase
            .from('ai_runs')
            .insert({
                project_id,
                triggered_by: userId,
                run_type: 'object_detection',
                status: 'running',
                model: 'openai/gpt-4o',
                input_context: {
                    file_count: files.length,
                    file_names: files.map(f => f.file_name)
                },
                prompt_messages: null,
                raw_response: null,
            })
            .select()
            .single();

        if (runError) {
            console.error('Failed to create ai_runs record:', runError);
        }

        // 4) Process each PDF file using OCR + LLM
        // 4) Process each PDF file using OCR + LLM
        let allDetectedObjects: DetectedObject[] = [];
        let combinedOcrText = '';
        let totalLatency = 0;
        let lastModel = '';
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;
        let totalTotalTokens = 0;

        for (const file of files) {
            // Download file from Supabase Storage
            const { data: fileData, error: dlError } = await supabase.storage
                .from('pid-files')
                .download(file.storage_path);

            if (dlError || !fileData) {
                console.error(`Failed to download file ${file.storage_path}:`, dlError);
                continue;
            }

            // Determine mime type from extension
            const ext = file.file_name.split('.').pop()?.toLowerCase();
            let mimeType = 'application/pdf';
            if (ext === 'png') mimeType = 'image/png';
            if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
            if (ext === 'webp') mimeType = 'image/webp';

            // Convert buffer to base64
            const fileBuffer = Buffer.from(await fileData.arrayBuffer());
            const base64File = fileBuffer.toString('base64');

            // Analyze using Dedalus Vision (OCR + LLM)
            // analyzeFile handles both PDF conversion and direct image processing
            const result = await analyzeFile(base64File, mimeType, {
                userId,
                projectId: project_id
            });

            allDetectedObjects = [...allDetectedObjects, ...result.objects];
            combinedOcrText += `\n--- File: ${file.file_name} (${mimeType}) ---\n[Vision Analysis - No OCR Text]`;
            totalLatency += result.metrics.latencyMs;
            lastModel = result.model;
            // Aggregate token usage
            totalPromptTokens += result.metrics.promptTokens || 0;
            totalCompletionTokens += result.metrics.completionTokens || 0;
            totalTotalTokens += result.metrics.totalTokens || 0;
        }

        if (allDetectedObjects.length === 0) {
            // Update ai_runs to failed
            if (aiRun) {
                await supabase.from('ai_runs').update({
                    status: 'failed',
                    error_message: 'No objects detected from uploaded PDFs',
                    completed_at: new Date().toISOString(),
                    latency_ms: Date.now() - startTime,
                }).eq('id', aiRun.id);
            }
            return NextResponse.json({ error: 'Failed to detect objects from PDF(s)' }, { status: 500 });
        }

        // 6) Delete existing object tasks for this project (for rerun support)
        await supabase
            .from('tasks')
            .delete()
            .eq('project_id', project_id)
            .eq('task_type', 'object');

        // 7) Insert detected objects as tasks
        // Recalculate display_order to be sequential across all files
        const taskRows = allDetectedObjects.map((obj, index) => ({
            project_id,
            task_type: 'object',
            title: obj.title,
            description: obj.description,
            // Structured data fields
            position: obj.position,
            connections: obj.connections,
            operating_conditions: obj.operating_conditions,
            chemicals: obj.chemicals,

            status: 'pending',
            display_order: index + 1,
        }));

        const { data: createdTasks, error: taskError } = await supabase
            .from('tasks')
            .insert(taskRows)
            .select();

        if (taskError) throw taskError;

        // 8) Update ai_runs to completed
        // 8) Update ai_runs to completed
        if (aiRun) {
            await supabase.from('ai_runs').update({
                status: 'completed',
                latency_ms: totalLatency,
                model: lastModel || 'openai/gpt-4o',
                total_tokens: totalTotalTokens,
                prompt_tokens: totalPromptTokens,
                completion_tokens: totalCompletionTokens,
                raw_response: {
                    object_count: allDetectedObjects.length,
                    objects: allDetectedObjects,
                    raw_text: combinedOcrText // Since we don't have a single raw LLM response (loop), we log metrics and internal list
                },
                // Actually, I should use the result.rawResponse if available, but it's in a loop.
                // Better: accumulate raw responses or just log the final object structure. 
                // The pfd-analysis returns rawResponse now. Let's try to capture it.
                // However, the loop structure makes it hard to log *one* raw response. 
                // Let's stick to logging the structured objects as 'raw_response' for now as that's what was there, 
                // but maybe wrap it to indicate it's the aggregated result.
                output_summary: `Found ${allDetectedObjects.length} objects`,
                ocr_text: combinedOcrText,
                completed_at: new Date().toISOString(),
            }).eq('id', aiRun.id);
        }

        // 9) Update project workflow stage
        await supabase
            .from('projects')
            .update({
                workflow_stage: 'objectReview',
                progress: 40,
            })
            .eq('id', project_id);

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
