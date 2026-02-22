
import { z } from 'zod';
import { getDedalusClient } from '../dedalus-client';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as PImage from 'pureimage';
import { Readable } from 'stream';
import path from 'path';
import { withLangfuseDedalus } from '../langfuse';

// Set worker source (though in Node it might not be needed or handled differently)
// specific setup for Node environment
// We need to set the worker to null to avoid using the web worker architecture in Node if possible, or point to the worker file.
// standard way in node:
// pdfjsLib.GlobalWorkerOptions.workerSrc = '...'; 

// Use a vision-capable model
const CHAT_MODEL = 'openai/gpt-4o';

// --- Schemas ---

export const DetectedObjectSchema = z.object({
    title: z.string().describe('Equipment name/tag, e.g. "P-101", "Reboiler E-201"'),
    equipment_type: z.string().describe('Category: pump, valve, reactor, heat exchanger, vessel, column, sensor, etc.'),
    position: z.string().describe('Relative location in process (e.g. "upstream of R-101", "feed section")'),
    connections: z.union([z.string(), z.array(z.string())])
        .transform(val => Array.isArray(val) ? val.join(', ') : val)
        .describe('Inlet/outlet connections (e.g. "from T-100 to P-101")'),
    operating_conditions: z.union([z.string(), z.array(z.string())])
        .transform(val => Array.isArray(val) ? val.join(', ') : val)
        .describe('Specs like temperature, pressure, flow rate (e.g. "150C, 5 bar")'),
    chemicals: z.union([z.string(), z.array(z.string())])
        .transform(val => Array.isArray(val) ? val.join(', ') : val)
        .describe('Chemicals involved or contained (e.g. "Unreacted Benzene", "Cooling Water")'),
    description: z.string().describe('Combined summary for the task description'),
    display_order: z.number().int().describe('Logical process order (1, 2, 3...)'),
});

export const DetectedObjectsResponseSchema = z.object({
    objects: z.array(DetectedObjectSchema),
});

export type DetectedObject = z.infer<typeof DetectedObjectSchema>;

// --- Prompts ---

const SYSTEM_PROMPT = `You are an expert chemical/process engineer specializing in reading Process Flow Diagrams (PFDs) and Piping & Instrumentation Diagrams (P&IDs).

Your task is to analyze the provided image(s) of a PFD and identify every piece of equipment, instrument, and major valve VISUALLY.

For each item you detect, provide:
- **title**: The equipment tag/name (e.g. "P-101", "Reactor R-101"). Infer tags if they are slightly blurry.
- **equipment_type**: The standard category (pump, vessel, reactor, heat exchanger, valve, column, etc.).
- **position**: The **relative position** in the process flow. Use terms like "upstream of R-101", "downstream of Y", "feed section", "recovery section".
- **connections**: Describe lines connecting to inlets and outlets based on the visual flow lines.
- **operating_conditions**: Extract any operating specs text found near the equipment (Temperature, Pressure, Flow Rate).
- **chemicals**: List chemicals processed, contained, or flowing through this unit based on labels or context.
- **description**: A concise summary of the equipment's purpose and context.
- **display_order**: Determine a logical integer order following the main process flow (Feed -> Reaction -> Separation -> Product).

Return ONLY valid JSON matching the schema.`;

const USER_PROMPT_TEMPLATE = `Analyze the attached PFD image(s). List every piece of equipment, instrument, and major valve. Return a JSON object with an "objects" array.`;

export interface PfdAnalysisResult {
    objects: DetectedObject[];
    model: string;
    rawResponse?: string;
    metrics: {
        latencyMs: number;
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
}

// --- Service ---

/**
 * Converts a base64 PDF to an array of base64 images (PNG) using pdfjs-dist and pureimage.
 */
export async function convertPdfToImages(base64Pdf: string): Promise<string[]> {
    // 1. Load PDF Document
    const pdfData = Buffer.from(base64Pdf, 'base64');
    const uint8Array = new Uint8Array(pdfData);

    // Ensure font path is absolute for runtime reliability
    const fontPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/');

    // Set worker source to the actual file path for Node environment
    // This allows pdfjs to process the PDF without browser worker support
    pdfjsLib.GlobalWorkerOptions.workerSrc = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

    // Configure loading task with robust options for Node.js
    const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        verbosity: 0,
        standardFontDataUrl: fontPath + '/',
        cMapUrl: path.resolve(process.cwd(), 'node_modules/pdfjs-dist/cmaps/') + '/',
        cMapPacked: true,
        disableFontFace: true, // Critical: Disables browser-specific font loading that fails in Node
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const images: string[] = [];

    // 2. Render each page
    for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Scale 2.0 for better resolution

        // Create a pureimage bitmap
        const bitmap = PImage.make(viewport.width, viewport.height);
        const context = bitmap.getContext('2d');

        // Render using the pureimage context
        // Note: pureimage might not support all canvas features pdfjs uses, but basic rendering usually works.
        // We need a custom canvas factory for pdfjs to interface with pureimage if passing context directly doesn't work.
        // pdfjs render method expects a canvas context that mimics HTML5 Canvas.

        // We pass the bitmap as 'canvas' to satisfy the type definition if needed, 
        // though pureimage bitmap isn't a full HTMLCanvasElement.
        await page.render({
            canvasContext: context as any,
            viewport: viewport,
            canvas: bitmap as any // Satisfy 'canvas' property requirement
        } as any).promise;

        // 3. Convert bitmap to PNG buffer, then base64
        const stream = new Readable();
        stream._read = () => { }; // No-op
        stream.push(null); // End immediately? No, we need to write to it.

        // Actually PImage.encodePNGToStream writes TO a stream.
        // We want to capture that stream into a buffer.

        const chunks: Uint8Array[] = [];
        const passThrough = new Readable({
            read() { }
        });

        // We can use a PassThrough stream or similar.
        // Let's use a temporary approach or a memory stream.

        // Simpler: use a promise wrapper around encodePNGToStream
        const pngBuffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: any[] = [];
            const writable = new Readable(); // wait, writable? No, Writable stream.

            // Let's implement a minimal writable stream to capture chunks
            const { Writable } = require('stream');
            const memoryStream = new Writable({
                write(chunk: any, encoding: any, callback: any) {
                    chunks.push(chunk);
                    callback();
                }
            });

            memoryStream.on('finish', () => {
                resolve(Buffer.concat(chunks));
            });

            memoryStream.on('error', reject);

            PImage.encodePNGToStream(bitmap, memoryStream).catch(reject);
        });

        images.push(pngBuffer.toString('base64'));
    }

    return images;
}

export async function analyzeFile(
    fileData: string,
    mimeType: string = 'application/pdf',
    traceOptions?: { userId?: string | null; projectId?: string }
): Promise<PfdAnalysisResult> {
    const startTime = Date.now();

    // 1. Prepare Images (Convert if PDF, else use as-is)
    console.log(`[File Analysis] Processing file of type: ${mimeType}`);
    let base64Images: string[] = [];

    try {
        if (mimeType === 'application/pdf') {
            console.log('[File Analysis] Converting PDF to images...');
            base64Images = await convertPdfToImages(fileData);
            console.log(`[File Analysis] Converted PDF to ${base64Images.length} images.`);
        } else if (mimeType.startsWith('image/')) {
            // It's already an image, use directly
            // Ensure we strip metadata prefix if present in the base64 string passing from elsewhere, 
            // but here we expect raw base64 usually. 
            // However, the analyzePfd caller in route.ts passes raw base64 from buffer.
            base64Images = [fileData];
            console.log('[File Analysis] Using provided image directly.');
        } else {
            throw new Error(`Unsupported file type: ${mimeType}`);
        }
    } catch (error: any) {
        console.error('[File Analysis] Image preparation failed:', error);
        throw new Error(`Failed to prepare images from file: ${error.message || error}`);
    }

    // 2. Prepare Vision Request
    const contentParts: any[] = [
        { type: 'text', text: USER_PROMPT_TEMPLATE }
    ];

    for (const base64Img of base64Images) {
        contentParts.push({
            type: 'image_url',
            image_url: {
                url: `data:image/png;base64,${base64Img}`, // Note: OpenAI accepts jpeg/png/etc. defaulting to png header is usually fine for base64 but correct mime is better.
                detail: 'high'
            }
        });
    }

    console.log(`[File Analysis] Sending ${base64Images.length} images to Vision Model (${CHAT_MODEL})...`);

    const response = await withLangfuseDedalus({
        traceName: "PFD Analysis Vision",
        userId: traceOptions?.userId,
        projectId: traceOptions?.projectId,
        model: CHAT_MODEL,
        input: {
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: USER_PROMPT_TEMPLATE,
            imagesCount: base64Images.length
        },
        execute: async () => {
            const client = getDedalusClient();
            const res = await client.chat.completions.create({
                model: CHAT_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: contentParts as any },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 4096,
                temperature: 0.1,
            });
            return {
                result: res,
                usage: res.usage,
                rawResponse: res.choices?.[0]?.message?.content
            };
        }
    });

    const latencyMs = Date.now() - startTime;
    const rawContent = response.choices?.[0]?.message?.content;

    if (!rawContent) {
        throw new Error(`No content in LLM response (finish_reason: ${response.choices?.[0]?.finish_reason})`);
    }

    // 3. Validation
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawContent);
    } catch {
        throw new Error('LLM returned invalid JSON');
    }

    const validated = DetectedObjectsResponseSchema.parse(parsed);

    return {
        objects: validated.objects,
        model: CHAT_MODEL,
        rawResponse: rawContent,
        metrics: {
            latencyMs,
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
            totalTokens: response.usage?.total_tokens,
        },
    };
}
