import { NextRequest, NextResponse } from 'next/server';
import { withLangfuseFetch, langfuse } from '@/lib/ai/langfuse';
import { requireProjectAccess } from '@/lib/api/access-control';
import { enforceRateLimit, internalServerErrorResponse } from '@/lib/api/security';
import { z } from 'zod';

const transcribeSchema = z.object({
    projectId: z.string().uuid('Invalid projectId')
});

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const projectId = formData.get('projectId') as string;

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const parsed = transcribeSchema.safeParse({ projectId });
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const access = await requireProjectAccess(req, parsed.data.projectId);
        if ('error' in access) {
            return access.error;
        }

        const apiKey = process.env.DEDALUS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Dedalus API key not configured' }, { status: 500 });
        }

        const { userId } = access;
        const limit = enforceRateLimit(`ai:transcribe:${userId}`, {
            windowMs: 60_000,
            maxRequests: 6,
        });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Try again later.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
            );
        }

        // Prepare formData for Dedalus API
        const dedalusFormData = new FormData();
        dedalusFormData.append('file', file);
        dedalusFormData.append('model', 'openai/whisper-1');

        let data;
        try {
            data = await withLangfuseFetch({
                traceName: "Meeting Transcription",
                userId,
                projectId,
                model: 'openai/whisper-1',
                input: { fileName: file.name, fileSize: file.size, mimeType: file.type },
                execute: async () => {
                    const response = await fetch('https://api.dedaluslabs.ai/v1/audio/transcriptions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        body: dedalusFormData,
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Dedalus Transcription API Error:', response.status, errorText);
                        throw new Error(`API Error ${response.status}: ${errorText}`);
                    }

                    const resData = await response.json();
                    return {
                        result: resData,
                        usage: undefined,
                        rawResponse: resData.text
                    };
                }
            });
        } catch (fetchError: any) {
            return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Transcription error:', error);

        return internalServerErrorResponse();
    } finally {
        await langfuse.flushAsync();
    }
}
