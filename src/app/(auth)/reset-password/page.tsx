'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const supabase = createClient()
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        setSuccess(true)
        setLoading(false)
    }

    if (success) {
        return (
            <div className="card p-8 text-center">
                <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'var(--color-primary-100)' }}
                >
                    <CheckCircle2 size={28} style={{ color: 'var(--color-primary-600)' }} />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-slate-900)' }}>
                    Check your email
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                    We&apos;ve sent a password reset link to <strong>{email}</strong>.
                </p>
                <Link href="/login" className="btn btn-secondary w-full">
                    <ArrowLeft size={16} />
                    Back to login
                </Link>
            </div>
        )
    }

    return (
        <div className="card p-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-slate-900)' }}>
                Reset password
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                Enter your email and we&apos;ll send you a reset link
            </p>

            <form onSubmit={handleReset} className="space-y-4">
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

                <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full py-2.5"
                    style={{ opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                    {loading ? 'Sending...' : 'Send reset link'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--color-primary-600)' }}
                >
                    <ArrowLeft size={14} />
                    Back to login
                </Link>
            </p>
        </div>
    )
}
