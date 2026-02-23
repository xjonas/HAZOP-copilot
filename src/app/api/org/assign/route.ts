import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        { error: 'Organization auto-assignment is disabled in Cognito login-only mode.' },
        { status: 410 }
    );
}
