import { Langfuse } from 'langfuse';

export const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || "https://cloud.langfuse.com"
});

/**
 * Helper to wrap Dedalus SDK calls (Pattern A) with Langfuse tracing.
 */
export async function withLangfuseDedalus<T>(options: {
    traceName: string;
    userId?: string | null;
    projectId?: string;
    model: string;
    input: any;
    execute: (trace: any) => Promise<{ result: T, usage?: any, rawResponse?: any }>;
}): Promise<T> {
    const trace = langfuse.trace({
        name: options.traceName,
        userId: options.userId || undefined,
        sessionId: options.projectId || undefined,
    });

    const generation = trace.generation({
        name: options.traceName + " Generation",
        model: options.model,
        input: options.input,
    });

    try {
        const { result, usage, rawResponse } = await options.execute(trace);

        generation.end({
            output: rawResponse || result,
            usage: usage,
        });

        return result;
    } catch (error: any) {
        generation.end({
            level: "ERROR",
            statusMessage: error.message || String(error),
        });
        throw error;
    } finally {
        await langfuse.flushAsync();
    }
}

/**
 * Helper to wrap raw fetch AI calls (Pattern B) with Langfuse tracing.
 */
export async function withLangfuseFetch<T>(options: {
    traceName: string;
    userId?: string | null;
    projectId?: string;
    model: string;
    input: any;
    execute: (trace: any) => Promise<{ result: T, usage?: any, rawResponse?: any }>;
}): Promise<T> {
    const trace = langfuse.trace({
        name: options.traceName,
        userId: options.userId || undefined,
        sessionId: options.projectId || undefined,
    });

    const generation = trace.generation({
        name: options.traceName + " Fetch",
        model: options.model,
        input: options.input,
    });

    try {
        const { result, usage, rawResponse } = await options.execute(trace);

        generation.end({
            output: rawResponse || result,
            usage: usage || undefined,
        });

        return result;
    } catch (error: any) {
        generation.end({
            level: "ERROR",
            statusMessage: error.message || String(error),
        });
        throw error;
    } finally {
        await langfuse.flushAsync();
    }
}
