'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function WelcomePage() {
    return (
        <div className="flex flex-col items-center">
            {/* Logo */}
            <div className="flex flex-col items-center justify-center gap-1 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center relative shadow-sm rounded-xl" style={{ backgroundColor: '#ffffff' }}>
                        <img
                            src="/logo.png"
                            alt="Katalonix Logo"
                            className="w-10 h-10 object-contain rounded-lg"
                        />
                    </div>
                    <span className="text-3xl font-extrabold" style={{ color: 'var(--color-slate-900)' }}>
                        HAZOP Copilot
                    </span>
                </div>
                <span className="text-sm font-semibold tracking-widest uppercase ml-12" style={{ color: 'var(--color-slate-400)' }}>
                    by Katalonix
                </span>
            </div>

            <div className="card p-8 text-center w-full">
                <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-slate-900)' }}>
                    Welcome to HAZOP Copilot
                </h1>
                <p className="text-sm mb-8" style={{ color: 'var(--color-slate-500)' }}>
                    Your AI-powered assistant for Hazard and Operability Studies. Streamline your safety reviews with intelligent insights.
                </p>
                <Link href="/login" className="btn btn-primary w-full flex items-center justify-center gap-2">
                    Sign In <ArrowRight size={18} />
                </Link>
            </div>
        </div>
    );
}
