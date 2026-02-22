type UploadValidationConfig = {
    allowedMimeTypes: string[];
    maxBytes: number;
};

function sanitizeFileName(fileName: string) {
    return fileName
        .normalize('NFKC')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');
}

function uniqueSuffix() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function validateUploadFile(file: File, config: UploadValidationConfig) {
    if (!config.allowedMimeTypes.includes(file.type)) {
        throw new Error('Invalid file type');
    }

    if (file.size > config.maxBytes) {
        throw new Error('File too large');
    }
}

export function buildSafeStoragePath(projectId: string, originalFileName: string) {
    const fileName = sanitizeFileName(originalFileName);
    return `${projectId}/${uniqueSuffix()}_${fileName}`;
}