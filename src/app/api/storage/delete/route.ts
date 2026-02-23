import { NextRequest, NextResponse } from 'next/server'
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security'
import { requireProjectAccess } from '@/lib/api/access-control'
import { deleteObject, type StorageBucketType } from '@/lib/storage/s3'

function parseBucketType(value: string | null): StorageBucketType {
    return value === 'meeting' ? 'meeting' : 'pid'
}

export async function POST(request: NextRequest) {
    try {
        if (!csrfOriginValid(request)) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
        }

        const body = await request.json()
        const storagePath = body?.storagePath as string | undefined
        const projectId = body?.projectId as string | undefined
        const bucketType = parseBucketType(body?.bucketType ?? null)

        if (!storagePath || !projectId) {
            return NextResponse.json({ error: 'Missing storagePath or projectId' }, { status: 400 })
        }

        const access = await requireProjectAccess(request, projectId)
        if ('error' in access) {
            return access.error
        }

        await deleteObject({
            bucketType,
            key: storagePath,
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Storage delete failed', error)
        return internalServerErrorResponse()
    }
}
