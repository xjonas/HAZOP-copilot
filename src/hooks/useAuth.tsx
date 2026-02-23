'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signOut as amplifySignOut } from 'aws-amplify/auth'
import { ensureAmplifyConfigured, hasAmplifyCognitoConfig } from '@/lib/auth/amplify-client'

export interface AuthUser {
    sub: string
    email: string | null
    fullName: string | null
}

interface AuthContextType {
    user: AuthUser | null
    orgName: string | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [orgName, setOrgName] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    const fetchOrgName = useCallback(async (authenticatedUser: AuthUser | null) => {
        if (!authenticatedUser) {
            setOrgName(null);
            return;
        }

        try {
            const res = await fetch('/api/org/me');

            if (res.ok) {
                const data = await res.json();
                setOrgName(data.org_name || null);
                return
            }

            setOrgName(null)
        } catch (err) {
            console.error("Failed to fetch org name", err);
            setOrgName(null)
        }
    }, [])

    const loadSession = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/session', { cache: 'no-store' })
            if (!response.ok) {
                setUser(null)
                setOrgName(null)
                setLoading(false)
                return
            }

            const data = await response.json()
            const nextUser = (data?.user ?? null) as AuthUser | null
            setUser(nextUser)
            await fetchOrgName(nextUser)
        } catch (error) {
            console.error('Failed to load auth session', error)
            setUser(null)
            setOrgName(null)
        } finally {
            setLoading(false)
        }
    }, [fetchOrgName])

    useEffect(() => {
        const onAuthChanged = () => {
            setLoading(true)
            loadSession()
        }

        loadSession()
        window.addEventListener('hazop-auth-changed', onAuthChanged)

        return () => {
            window.removeEventListener('hazop-auth-changed', onAuthChanged)
        }
    }, [loadSession])

    const signOut = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            if (hasAmplifyCognitoConfig()) {
                ensureAmplifyConfigured()
                try {
                    await amplifySignOut({ global: true })
                } catch (error) {
                    console.warn('Amplify signOut skipped:', error)
                }
            }
        } finally {
            setUser(null)
            setOrgName(null)
            window.dispatchEvent(new Event('hazop-auth-changed'))
            router.push('/login')
            router.refresh()
            setLoading(false)
        }
    }, [router])

    return (
        <AuthContext.Provider value={{ user, orgName, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
