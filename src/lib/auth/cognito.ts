import { jwtVerify, createRemoteJWKSet } from 'jose'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

const SESSION_COOKIE_NAME = 'hazop_session'

type CognitoTokenUse = 'id' | 'access'

export interface AuthenticatedUser {
	sub: string
	email: string | null
	fullName: string | null
}

export interface ProvisionedAuthenticatedUser extends AuthenticatedUser {
	userId: string
	orgId: string | null
}

interface CognitoJwtPayload {
	sub: string
	email?: string
	name?: string
	token_use?: CognitoTokenUse
	aud?: string
	exp?: number
	iat?: number
	iss?: string
}

function getEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing required env var: ${name}`)
	}
	return value
}

function getCognitoConfig() {
	const region = getEnv('NEXT_PUBLIC_AWS_COGNITO_REGION')
	const userPoolId = getEnv('NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID')
	const userPoolClientId = getEnv('NEXT_PUBLIC_AWS_COGNITO_USER_POOL_CLIENT_ID')
	const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
	return { userPoolClientId, issuer }
}

function getJwks() {
	const { issuer } = getCognitoConfig()
	return createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
}

async function verifyToken(idToken: string, tokenUse: CognitoTokenUse): Promise<CognitoJwtPayload> {
	const { issuer, userPoolClientId } = getCognitoConfig()

	const { payload } = await jwtVerify(idToken, getJwks(), {
		issuer,
		audience: userPoolClientId,
	})

	const tokenUseClaim = payload.token_use
	if (tokenUseClaim !== tokenUse) {
		throw new Error('Invalid token_use claim')
	}

	if (typeof payload.sub !== 'string' || !payload.sub) {
		throw new Error('Missing sub claim')
	}

	return payload as CognitoJwtPayload
}

export async function verifyCognitoIdToken(idToken: string): Promise<AuthenticatedUser> {
	const payload = await verifyToken(idToken, 'id')
	return {
		sub: payload.sub,
		email: payload.email ?? null,
		fullName: payload.name ?? null,
	}
}

function fallbackEmailFromSub(sub: string): string {
	return `${sub}@cognito.local`
}

function deriveDisplayName(email: string, fallback: string): string {
	const source = email && email.includes('@') ? email.split('@')[0] : fallback
	const cleaned = source.replace(/[._-]+/g, ' ').trim()
	if (!cleaned) {
		return 'Team Member'
	}

	return cleaned
		.split(/\s+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(' ')
}

export async function ensureProvisionedUser(user: AuthenticatedUser): Promise<ProvisionedAuthenticatedUser> {
	const normalizedEmail = user.email?.trim() || fallbackEmailFromSub(user.sub)
	const normalizedFullName = user.fullName?.trim() || null
	const db = getDb()

	const [existingBySub] = await db
		.select({ id: users.id, orgId: users.orgId, fullName: users.fullName })
		.from(users)
		.where(eq(users.cognitoSub, user.sub))
		.limit(1)

	if (existingBySub) {
		const fullName = normalizedFullName || existingBySub.fullName || deriveDisplayName(normalizedEmail, user.sub)

		await db
			.update(users)
			.set({
				email: normalizedEmail,
				fullName,
				updatedAt: sql`now()`,
			})
			.where(eq(users.id, existingBySub.id))

		return {
			...user,
			email: normalizedEmail,
			fullName,
			userId: existingBySub.id,
			orgId: existingBySub.orgId ?? null,
		}
	}

	const [existingByEmail] = await db
		.select({ id: users.id, orgId: users.orgId, fullName: users.fullName })
		.from(users)
		.where(eq(users.email, normalizedEmail))
		.limit(1)

	if (existingByEmail) {
		const fullName = normalizedFullName || existingByEmail.fullName || deriveDisplayName(normalizedEmail, user.sub)

		await db
			.update(users)
			.set({
				cognitoSub: user.sub,
				fullName,
				updatedAt: sql`now()`,
			})
			.where(eq(users.id, existingByEmail.id))

		return {
			...user,
			email: normalizedEmail,
			fullName,
			userId: existingByEmail.id,
			orgId: existingByEmail.orgId ?? null,
		}
	}

	const fullName = normalizedFullName || deriveDisplayName(normalizedEmail, user.sub)

	const [upserted] = await db
		.insert(users)
		.values({
			cognitoSub: user.sub,
			email: normalizedEmail,
			fullName,
		})
		.returning({ id: users.id, orgId: users.orgId, email: users.email, fullName: users.fullName })

	if (!upserted) {
		throw new Error('Failed to provision authenticated user')
	}

	return {
		...user,
		email: upserted.email,
		fullName: upserted.fullName || fullName,
		userId: upserted.id,
		orgId: upserted.orgId ?? null,
	}
}

export function setSessionCookie(response: NextResponse, idToken: string) {
	response.cookies.set(SESSION_COOKIE_NAME, idToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 8,
	})
}

export function clearSessionCookie(response: NextResponse) {
	response.cookies.set(SESSION_COOKIE_NAME, '', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 0,
	})
}

export function getSessionTokenFromRequest(request: NextRequest): string | null {
	return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
}

export function hasSessionCookie(request: NextRequest): boolean {
	return Boolean(getSessionTokenFromRequest(request))
}

export async function getAuthenticatedUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
	const token = getSessionTokenFromRequest(request)
	if (!token) {
		return null
	}

	try {
		return await verifyCognitoIdToken(token)
	} catch {
		return null
	}
}

