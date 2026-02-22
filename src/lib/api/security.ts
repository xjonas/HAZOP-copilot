import { NextRequest, NextResponse } from 'next/server';

type RateLimitConfig = {
    windowMs: number;
    maxRequests: number;
};

type BucketState = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, BucketState>();

export function internalServerErrorResponse() {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export function enforceRateLimit(
    key: string,
    config: RateLimitConfig
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true };
    }

    if (current.count >= config.maxRequests) {
        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
        };
    }

    current.count += 1;
    buckets.set(key, current);
    return { allowed: true };
}

export function csrfOriginValid(request: NextRequest) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (!origin || !host) return false;

    try {
        const parsed = new URL(origin);
        return parsed.host === host;
    } catch {
        return false;
    }
}