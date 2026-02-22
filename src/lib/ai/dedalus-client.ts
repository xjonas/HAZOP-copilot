import Dedalus from 'dedalus-labs';

let client: Dedalus | null = null;

/**
 * Returns a singleton Dedalus client instance.
 * Server-side only — never import this in client components.
 */
export function getDedalusClient(): Dedalus {
    if (!client) {
        const apiKey = process.env.DEDALUS_API_KEY;
        if (!apiKey) {
            throw new Error('DEDALUS_API_KEY environment variable is not set');
        }
        client = new Dedalus({ apiKey });
    }
    return client;
}
