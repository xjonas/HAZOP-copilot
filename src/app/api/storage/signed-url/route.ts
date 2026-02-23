import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAccess } from '@/lib/api/access-control'
import { createSignedObjectUrl, objectExists, type StorageBucketType } from '@/lib/storage/s3'
import { internalServerErrorResponse } from '@/lib/api/security'

function parseBucketType(value: string | null): StorageBucketType {
    return value === 'meeting' ? 'meeting' : 'pid'
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

        return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    } catch (error) {
        console.error('Signed URL generation failed', error)
        return internalServerErrorResponse()
    }
}
