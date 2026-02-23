import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '@/lib/api/access-control'
import { createSignedObjectUrl, objectExists, type StorageBucketType } from '@/lib/storage/s3'
import { internalServerErrorResponse } from '@/lib/api/security'
import { createAdminClient } from '@/lib/supabase/server'

function parseBucketType(value: string | null): StorageBucketType {
    return value === 'meeting' ? 'meeting' : 'pid'
}

function legacySupabaseBucket(bucketType: StorageBucketType): string {
    return bucketType === 'meeting' ? 'meeting-recordings' : 'pid-files'
}

export async function GET(request: NextRequest) {
    try {
        const storagePath = request.nextUrl.searchParams.get('storagePath')
        const projectId = request.nextUrl.searchParams.get('projectId')
        const bucketType = parseBucketType(request.nextUrl.searchParams.get('bucketType'))

        if (!storagePath || !projectId) {
            return NextResponse.json({ error: 'Missing storagePath or projectId' }, { status: 400 })
        }

        const access = await requireProjectAccess(request, projectId)
        if ('error' in access) {
            return access.error
        }

        if (await objectExists({ bucketType, key: storagePath })) {
            const signedUrl = await createSignedObjectUrl({
                bucketType,
                key: storagePath,
                expiresInSeconds: 3600,
            })

            return NextResponse.json({ signedUrl, source: 's3' })
        }

        const supabaseAdmin = createAdminClient()
        const fallbackBucket = legacySupabaseBucket(bucketType)
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin.storage
            .from(fallbackBucket)
            .createSignedUrl(storagePath, 3600)

        if (fallbackError || !fallbackData?.signedUrl) {
            return NextResponse.json({ error: 'File not found in storage backends' }, { status: 404 })
        }

        return NextResponse.json({ signedUrl: fallbackData.signedUrl, source: 'supabase' })
    } catch (error) {
        console.error('Signed URL generation failed', error)
        return internalServerErrorResponse()
    }
}
