'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setLoading(true)

        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password })

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
            <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--color-primary-100)' }}
            >
                <CheckCircle2 size={24} style={{ color: 'var(--color-primary-600)' }} />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--color-slate-900)' }}>
                Set new password
            </h1>
            <p className="text-sm mb-6 text-center" style={{ color: 'var(--color-slate-500)' }}>
                Enter your new password below
            </p>

            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>
                        New Password
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

                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-slate-700)' }}>
                        Confirm New Password
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
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                    {loading ? 'Updating...' : 'Update password'}
                </button>
            </form>
        </div>
    )
}
