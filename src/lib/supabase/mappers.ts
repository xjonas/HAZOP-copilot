/**
 * Convert snake_case DB rows to camelCase TS objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCamel<T>(row: Record<string, any>): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        out[camelKey] = value;
    }
    return out as T;
}

/**
 * Convert camelCase TS object keys to snake_case for DB inserts/updates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSnake(obj: Record<string, any>): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        out[snakeKey] = value;
    }
    return out;
}

/**
 * Map an array of DB rows to camelCase TS objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRows<T>(rows: Record<string, any>[]): T[] {
    return rows.map((row) => toCamel<T>(row));
}
