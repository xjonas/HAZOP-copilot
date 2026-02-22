import React from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            style={{ backgroundColor: 'var(--bg-app)' }}
        >
            <div className="w-full max-w-md">
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

                {/* Content */}
                {children}
            </div>
        </div>
    )
}
