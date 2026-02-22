'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        router.push('/')
        router.refresh()
    }

    return (
        <div className="card p-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-slate-900)' }}>
                Welcome back
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                Sign in to your account to continue
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>
                        Email
                    </label>
                    <div className="relative">
                        <Mail
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-slate-400)' }}
                        />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="input !pl-10"
                            autoComplete="email"
                        />
                    </div>
                </div>

                {/* Password */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>
                        Password
                    </label>
                    <div className="relative">
                        <Lock
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-slate-400)' }}
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="input !pl-10"
                            autoComplete="current-password"
                        />
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div
                        className="text-sm p-3 rounded-lg"
                        style={{
                            backgroundColor: '#fef2f2',
                            color: 'var(--color-danger-600)',
                            border: '1px solid #fecaca',
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full py-2.5"
                    style={{ opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <LogIn size={18} />
                    )}
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            {/* Links */}
            <div className="mt-6 space-y-3 text-center text-sm">
                <Link
                    href="/reset-password"
                    className="block hover:underline"
                    style={{ color: 'var(--color-primary-600)' }}
                >
                    Forgot your password?
                </Link>
                <p style={{ color: 'var(--color-slate-500)' }}>
                    Don&apos;t have an account?{' '}
                    <Link
                        href="/signup"
                        className="font-medium hover:underline"
                        style={{ color: 'var(--color-primary-600)' }}
                    >
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    )
}
