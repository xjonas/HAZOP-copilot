'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
    user: User | null
    orgName: string | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [orgName, setOrgName] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    const fetchOrgName = async (session: any) => {
        if (!session) {
            setOrgName(null);
            return;
        }
        try {
            let res = await fetch('/api/org/me', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                const data = await res.json();

                // If no org exists, but the user has a company_name in their metadata from signup, auto-assign them.
                if (!data.org_name && session.user.user_metadata?.company_name) {
                    const assignRes = await fetch('/api/org/assign', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${session.access_token}` },
                    });

                    if (assignRes.ok) {
                        // Re-fetch the org name to confirm assignment
                        res = await fetch('/api/org/me', {
                            headers: { 'Authorization': `Bearer ${session.access_token}` },
                        });
                        if (res.ok) {
                            const newData = await res.json();
                            setOrgName(newData.org_name || null);
                            return;
                        }
                    }
                }

                setOrgName(data.org_name || null);
            }
        } catch (err) {
            console.error("Failed to fetch org name", err);
        }
    }

    useEffect(() => {
        const supabase = createClient()

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const newUser = session?.user ?? null;
            setUser(prev => prev?.id === newUser?.id ? prev : newUser);
            if (session) {
                fetchOrgName(session);
            } else {
                setLoading(false);
            }
        })

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const newUser = session?.user ?? null;
            setUser(prev => prev?.id === newUser?.id ? prev : newUser);
            await fetchOrgName(session);
            setLoading(false)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const signOut = useCallback(async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        setUser(null)
        setOrgName(null)
        router.push('/login')
        router.refresh()
    }, [router])

    // Wait until orgName fetch resolves before removing loading state initially
    useEffect(() => {
        if (user && orgName !== null) {
            setLoading(false);
        }
    }, [user, orgName]);

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
