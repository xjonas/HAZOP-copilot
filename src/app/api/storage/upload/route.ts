import { NextRequest, NextResponse } from 'next/server'
import { csrfOriginValid, internalServerErrorResponse } from '@/lib/api/security'
import { requireProjectAccess } from '@/lib/api/access-control'
import { buildSafeStoragePath, validateUploadFile } from '@/lib/storage/upload-security'
import { uploadObject, type StorageBucketType } from '@/lib/storage/s3'

const ALLOWED_BY_BUCKET: Record<StorageBucketType, string[]> = {
    pid: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    meeting: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm'],
}

const MAX_BYTES_BY_BUCKET: Record<StorageBucketType, number> = {
    pid: 50 * 1024 * 1024,
    meeting: 250 * 1024 * 1024,
}

function parseBucketType(value: FormDataEntryValue | null): StorageBucketType {
    return value === 'meeting' ? 'meeting' : 'pid'
}

export async function POST(request: NextRequest) {
    try {
        if (!csrfOriginValid(request)) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const projectId = formData.get('projectId')?.toString()
        const bucketType = parseBucketType(formData.get('bucketType'))

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
        }

        if (!file) {
            return NextResponse.json({ error: 'Missing file' }, { status: 400 })
        }

        const access = await requireProjectAccess(request, projectId)
        if ('error' in access) {
            return access.error
        }

        validateUploadFile(file, {
            allowedMimeTypes: ALLOWED_BY_BUCKET[bucketType],
            maxBytes: MAX_BYTES_BY_BUCKET[bucketType],
        })

        const key = buildSafeStoragePath(projectId, file.name)
        const bytes = Buffer.from(await file.arrayBuffer())

        await uploadObject({
            bucketType,
            key,
            body: bytes,
            contentType: file.type || 'application/octet-stream',
        })

        return NextResponse.json({ storagePath: key, bucketType })
    } catch (error) {
        console.error('Storage upload failed', error)
        return internalServerErrorResponse()
    }
}
