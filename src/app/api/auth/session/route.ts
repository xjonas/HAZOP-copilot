import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie, ensureProvisionedUser, getSessionTokenFromRequest, verifyCognitoIdToken } from '@/lib/auth/cognito'

export async function GET(request: NextRequest) {
    const token = getSessionTokenFromRequest(request)

    if (!token) {
        return NextResponse.json({ user: null }, { status: 401 })
    }

    let user
    try {
        user = await verifyCognitoIdToken(token)
    } catch {
        const response = NextResponse.json({ user: null }, { status: 401 })
        clearSessionCookie(response)
        return response
    }

    try {
        const provisionedUser = await ensureProvisionedUser(user)
        return NextResponse.json({ user: provisionedUser })
    } catch (error) {
        console.error('Auth session provisioning failed', error)
        return NextResponse.json({ error: 'Failed to initialize user session' }, { status: 500 })
    }
}
