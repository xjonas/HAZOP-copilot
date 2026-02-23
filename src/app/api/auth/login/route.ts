import { NextRequest, NextResponse } from 'next/server'
import { ensureProvisionedUser, setSessionCookie, verifyCognitoIdToken } from '@/lib/auth/cognito'

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const idToken = body?.idToken

		if (typeof idToken !== 'string' || !idToken) {
			return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
		}

		let user
		try {
			user = await verifyCognitoIdToken(idToken)
		} catch (error) {
			console.error('Auth login token verification failed', error)
			return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
		}

		let provisionedUser
		try {
			provisionedUser = await ensureProvisionedUser(user)
		} catch (error) {
			console.error('Auth login user provisioning failed', error)
			return NextResponse.json({ error: 'Failed to initialize user session' }, { status: 500 })
		}

		const response = NextResponse.json({ user: provisionedUser })
		setSessionCookie(response, idToken)
		return response
	} catch (error) {
		console.error('Auth login failed', error)
		return NextResponse.json({ error: 'Failed to process login request' }, { status: 500 })
	}
}

