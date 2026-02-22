'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface OrgMemberOption {
    id: string;
    full_name: string;
}

export function useOrgMembers() {
    const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);

    useEffect(() => {
        const fetchMembers = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setOrgMembers([]);
                return;
            }

            try {
                const res = await fetch('/api/org/members', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });

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
