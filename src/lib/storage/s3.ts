import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export type StorageBucketType = 'pid' | 'meeting'

function getEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Missing required env var: ${name}`)
    }
    return value
}

function getRegion(): string {
    return getEnv('env_AWS_REGION')
}

function getCredentials(): { accessKeyId: string; secretAccessKey: string } | undefined {
    const accessKeyId = process.env.env_AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.env_AWS_SECRET_ACCESS_KEY

    if (!accessKeyId || !secretAccessKey) {
        return undefined
    }

    return { accessKeyId, secretAccessKey }
}

const s3Client = new S3Client({
    region: getRegion(),
    credentials: getCredentials(),
})

export function getBucketName(bucketType: StorageBucketType): string {
    if (bucketType === 'pid') {
        return getEnv('env_AWS_S3_PID_BUCKET')
    }

    return process.env.env_AWS_S3_MEETING_BUCKET || getEnv('env_AWS_S3_PID_BUCKET')
}

export async function uploadObject(params: {
    bucketType: StorageBucketType
    key: string
    body: Buffer
    contentType: string
}) {
    const bucket = getBucketName(params.bucketType)
    await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
    }))
}

export async function createSignedObjectUrl(params: {
    bucketType: StorageBucketType
    key: string
    expiresInSeconds?: number
}): Promise<string> {
    const bucket = getBucketName(params.bucketType)
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: params.key,
    })

    return getSignedUrl(s3Client, command, { expiresIn: params.expiresInSeconds ?? 3600 })
}

export async function deleteObject(params: {
    bucketType: StorageBucketType
    key: string
}) {
    const bucket = getBucketName(params.bucketType)
    await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: params.key,
    }))
}

export async function objectExists(params: {
    bucketType: StorageBucketType
    key: string
}): Promise<boolean> {
    const bucket = getBucketName(params.bucketType)
    try {
        await s3Client.send(new HeadObjectCommand({
            Bucket: bucket,
            Key: params.key,
        }))
        return true
    } catch {
        return false
    }
}

export async function getObjectBuffer(params: {
    bucketType: StorageBucketType
    key: string
}): Promise<Buffer> {
    const bucket = getBucketName(params.bucketType)
    const response = await s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: params.key,
    }))

    if (!response.Body) {
        throw new Error('S3 object body is empty')
    }

    const bytes = await response.Body.transformToByteArray()
    return Buffer.from(bytes)
}
