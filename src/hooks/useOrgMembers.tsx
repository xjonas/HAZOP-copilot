'use client';

import { useEffect, useState } from 'react';

export interface OrgMemberOption {
    id: string;
    full_name: string;
}

export function useOrgMembers() {
    const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const res = await fetch('/api/org/members');

                if (!res.ok) {
                    setOrgMembers([]);
                    return;
                }

                const data = await res.json();
                setOrgMembers(data.members || []);
            } catch (err) {
                console.error('Failed to fetch org members', err);
                setOrgMembers([]);
            }
        };

        fetchMembers();
    }, []);

    return { orgMembers };
}
