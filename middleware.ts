import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { hasSessionCookie } from '@/lib/auth/cognito'

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const hasSession = hasSessionCookie(request)

    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/welcome')
    const isPublicApiRoute =
        pathname.startsWith('/api/auth/login') ||
        pathname.startsWith('/api/auth/session') ||
        pathname.startsWith('/api/auth/logout')
    const isApiRoute = pathname.startsWith('/api')

    if (!hasSession && !isAuthRoute && !isPublicApiRoute) {
        if (isApiRoute) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/welcome'
        return NextResponse.redirect(loginUrl)
    }

    if (hasSession && isAuthRoute) {
        const appUrl = request.nextUrl.clone()
        appUrl.pathname = '/'
        return NextResponse.redirect(appUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
