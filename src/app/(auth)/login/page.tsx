'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchAuthSession, signOut } from 'aws-amplify/auth'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { ensureAmplifyConfigured, hasAmplifyCognitoConfig } from '@/lib/auth/amplify-client'

function PostLoginSessionSync() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true

        const syncSession = async () => {
            try {
                const session = await fetchAuthSession()
                const idToken = session.tokens?.idToken?.toString()

                if (!idToken) {
                    throw new Error('Missing id token from Cognito session')
                }

                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken }),
                })

                if (!response.ok) {
                    throw new Error('Backend session login failed')
                }

                if (mounted) {
                    window.dispatchEvent(new Event('hazop-auth-changed'))
                    router.push('/')
                    router.refresh()
                }
            } catch (syncError) {
                console.error(syncError)
                await signOut()
                if (mounted) {
                    setError('Sign in failed. Please try again.')
                }
            }
        }

        syncSession()

        return () => {
            mounted = false
        }
    }, [router])

    if (error) {
        return (
            <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#fef2f2', color: 'var(--color-danger-600)', border: '1px solid #fecaca' }}>
                {error}
            </div>
        )
    }

    return <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>Finishing sign in...</p>
}

export default function LoginPage() {
    const missingConfig = useMemo(() => {
        return !hasAmplifyCognitoConfig()
    }, [])

    useEffect(() => {
        ensureAmplifyConfigured()
    }, [])

    if (missingConfig) {
        return (
            <div className="card p-8">
                <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-slate-900)' }}>
                    Configuration needed
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-slate-500)' }}>
                    Set Cognito environment variables to enable sign in.
                </p>
            </div>
        )
    }

    return (
        <div className="auth-amplify">
            <Authenticator
                hideSignUp
                components={{
                    SignIn: {
                        Header: () => null,
                        Footer: () => null,
                    },
                    Header: () => null,
                    Footer: () => null,
                }}
            >
                {({ user }) => user ? <PostLoginSessionSync /> : <div />}
            </Authenticator>
        </div>
    )
}
