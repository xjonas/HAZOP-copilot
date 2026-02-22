'use client';

import { redirect } from 'next/navigation';
import { use } from 'react';

export default function ProjectRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    redirect(`/projects/${id}/dashboard`);
}
