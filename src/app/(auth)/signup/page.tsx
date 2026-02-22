'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Mail, Lock, User, UserPlus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [companyName, setCompanyName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Client-side validation
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        if (!companyName.trim()) {
            setError('Company Name is required.')
            return
        }

        setLoading(true)

        // 1. Verify company exists
        try {
            const checkRes = await fetch('/api/org/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: companyName.trim() }),
            });

            if (!checkRes.ok) {
                if (checkRes.status === 404) {
                    setError('Company does not exist in our records.');
                } else {
                    setError('Failed to verify company name.');
                }
                setLoading(false);
                return;
            }
        } catch (err) {
            setError('Failed to verify company name.');
            setLoading(false);
            return;
        }

        const supabase = createClient()
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    company_name: companyName.trim(),
                },
            },
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        if (data.user && data.user.identities && data.user.identities.length === 0) {
            setError('This email is already registered. Please sign in instead.')
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
                    <Mail size={28} style={{ color: 'var(--color-primary-600)' }} />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-slate-900)' }}>
                    Check your email
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                    We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link to
                    activate your account.
                </p>
                <Link
                    href="/login"
                    className="btn btn-secondary w-full"
                >
                    Back to login
                </Link>
            </div>
        )
    }

    return (
        <div className="card p-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-slate-900)' }}>
                Create an account
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-slate-500)' }}>
                Get started with HAZOP Copilot
            </p>

            <form onSubmit={handleSignup} className="space-y-4">
                {/* Full Name */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>
                        Full Name
                    </label>
                    <div className="relative">
                        <User
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-slate-400)' }}
                        />
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Doe"
                            className="input !pl-10"
                            autoComplete="name"
                            required
                        />
                    </div>
                </div>

                {/* Company Name */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>
                        Company Name
                    </label>
                    <div className="relative">
                        <User
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-slate-400)' }}
                        />
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Acme Corp"
                            className="input !pl-10"
                            required
                        />
                    </div>
                </div>

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
                            minLength={6}
                            className="input !pl-10"
                            autoComplete="new-password"
                        />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-slate-400)' }}>
                        Minimum 6 characters
                    </p>
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>
                        Confirm Password
                    </label>
                    <div className="relative">
                        <Lock
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-slate-400)' }}
                        />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="input !pl-10"
                            autoComplete="new-password"
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
                        <UserPlus size={18} />
                    )}
                    {loading ? 'Creating account...' : 'Create account'}
                </button>
            </form>

            {/* Link */}
            <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-slate-500)' }}>
                Already have an account?{' '}
                <Link
                    href="/login"
                    className="font-medium hover:underline"
                    style={{ color: 'var(--color-primary-600)' }}
                >
                    Sign in
                </Link>
            </p>
        </div>
    )
}
