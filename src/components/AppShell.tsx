'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    FolderKanban,
    Settings,
    ChevronRight,
    Play,
    ClipboardList,
    User,
    LogOut,
    Calendar,
    Menu,
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';

const mainNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
];

const projectNavItems = [
    { path: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
    { path: 'workspace', icon: Play, label: 'HAZOP Onboarding' },
    { path: 'hazop-analysis', icon: ClipboardList, label: 'HAZOP Analysis' },
    { path: 'meetings', icon: Calendar, label: 'Meetings' },
    { path: 'settings', icon: Settings, label: 'Settings' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? '';
    const router = useRouter();
    const { projects } = useProjects();
    const { user, orgName, signOut, loading } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/welcome');
        }
    }, [user, loading, router]);

    // Determine if we're in a project context
    const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
    const projectId = projectMatch?.[1];
    const isProjectRoute = !!projectId && projectId !== 'new';

    const currentProject = useMemo(() => {
        if (!isProjectRoute || !projectId) return null;
        return projects.find(p => p.id === projectId) || null;
    }, [isProjectRoute, projectId, projects]);

    // Page title
    const pageTitle = useMemo(() => {
        if (pathname === '/') return 'Dashboard';
        if (pathname === '/projects') return 'Projects';
        if (pathname === '/projects/new') return 'New Project';
        if (isProjectRoute && currentProject) {
            const subPath = pathname.split('/').pop();
            const navItem = projectNavItems.find(item => item.path === subPath);
            return navItem ? `${currentProject.name} — ${navItem.label}` : currentProject.name;
        }
        return 'HAZOP Copilot';
    }, [pathname, isProjectRoute, currentProject]);

    if (loading || !user) {
        return (
            <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}>
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside
                className={`flex-shrink-0 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16 items-center'}`}
                style={{ backgroundColor: 'var(--bg-sidebar)' }}
            >
                {/* Logo */}
                <div className={`p-6 flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center p-4'}`}>
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center relative">
                        <img
                            src="/logo.png"
                            alt="Katalonix Logo"
                            className="w-full h-full object-contain drop-shadow-md rounded-md"
                        />
                    </div>
                    {isSidebarOpen && (
                        <div className="flex flex-col whitespace-nowrap overflow-hidden">
                            <span className="text-white font-bold text-lg leading-tight">HAZOP Copilot</span>
                            <span className="text-white/50 text-[10px] font-semibold tracking-wider uppercase">by Katalonix</span>
                        </div>
                    )}
                </div>

                {/* Main nav */}
                <nav className="px-3 flex-1 overflow-auto">
                    <div className="space-y-1 mb-6">
                        {mainNavItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive
                                        ? 'bg-white/10 text-white font-medium'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <Icon size={18} className="flex-shrink-0" />
                                    {isSidebarOpen && <span>{item.label}</span>}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Project-specific nav */}
                    {isProjectRoute && currentProject && (
                        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            {isSidebarOpen && (
                                <p className="px-3 mb-2 text-xs font-medium text-white/40 uppercase tracking-wider truncate">
                                    {currentProject.name}
                                </p>
                            )}
                            <div className="space-y-1">
                                {projectNavItems.map((item) => {
                                    const Icon = item.icon;
                                    const fullPath = `/projects/${projectId}/${item.path}`;
                                    const isActive = pathname === fullPath;
                                    return (
                                        <Link
                                            key={item.path}
                                            href={fullPath}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${isActive
                                                ? 'bg-white/10 text-white font-medium'
                                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <Icon size={16} className="flex-shrink-0" />
                                            {isSidebarOpen && <span>{item.label}</span>}
                                            {isActive && isSidebarOpen && <ChevronRight size={14} className="ml-auto flex-shrink-0" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </nav>

                {/* Settings & Logout */}
                <div className="p-3 mt-auto space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Link
                        href="/settings"
                        className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 w-full rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all`}
                        title={!isSidebarOpen ? "Settings" : undefined}
                    >
                        <Settings size={18} className="flex-shrink-0" />
                        {isSidebarOpen && <span>Settings</span>}
                    </Link>
                    <button
                        onClick={() => signOut()}
                        className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center'} py-2.5 w-full rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all`}
                        title={!isSidebarOpen ? "Logout" : undefined}
                    >
                        <LogOut size={18} className="flex-shrink-0" />
                        {isSidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header
                    className="h-16 flex-shrink-0 flex items-center justify-between px-8"
                    style={{
                        backgroundColor: 'var(--bg-header)',
                        borderBottom: '1px solid var(--color-slate-200)',
                    }}
                >
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                            title="Toggle Sidebar"
                        >
                            <Menu size={20} />
                        </button>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--color-slate-900)' }}>
                            {pageTitle}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {user && (
                            <span className="text-sm" style={{ color: 'var(--color-slate-500)' }}>
                                {orgName ? `${orgName} - ` : ''}{user.fullName || user.email || user.sub}
                            </span>
                        )}
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-100)' }}>
                            <User size={18} style={{ color: 'var(--color-primary-600)' }} />
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto p-8" style={{ backgroundColor: 'var(--bg-app)' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
