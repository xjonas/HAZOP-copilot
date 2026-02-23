export interface Project {
    id: string;
    orgId: string;
    name: string;
    description?: string;
    status: 'planning' | 'active' | 'in-progress' | 'review' | 'completed';
    processDescription?: string;
    deadline?: string;
    location?: string;
    leadPerson?: string;
    responsiblePerson?: string;
    progress: number; // 0-100
    workflowStage?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectFile {
    id: string;
    projectId: string;
    fileName: string;
    storagePath: string;
    mimeType: string;
    sizeBytes?: number;
    uploadedBy?: string;
    createdAt: string;
}

export interface Task {
    id: string; // UUID
    projectId: string;
    taskType: 'object' | 'node';
    title: string;
    description: string;
    status: string;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
    // Structured Data (AI Enhanced)
    operatingConditions?: string;
    position?: string;
    connections?: string;
    chemicals?: string;
    designIntent?: string;
    boundaries?: string;
    equipmentTags?: string;
    objects?: string;
}

export interface HazopRow {
    id: string;
    nodeTaskId: string;  // FK → tasks.id
    guideWord: string;
    parameter: string;
    deviation: string;
    causes: string;
    consequences: string;
    safeguards: string;
    recommendations: string;
    severity: number;
    likelihood: number;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface Meeting {
    id: string;
    projectId: string;
    title: string;
    date: string;
    attendees: string[];
    notes: string;
    summary?: string;
    transcript?: string;
    recording: boolean;
    recordingPath?: string;
    duration?: string;
    createdAt: string;
}

// Used by PdfViewer component (keeps backward compatibility)
export interface PdfFile {
    name: string;
    url: string | File;
}

export interface RegulationUpdate {
    id: string;
    title: string;
    summary: string;
    date: string;
    severity: 'low' | 'medium' | 'high';
}

export interface HazopNode {
    id: string;
    name: string;
    description: string;
}

export interface HazopEntry {
    id: string;
    nodeId: string;
    deviation: string;
    cause: string;
    consequence: string;
    safeguard: string;
    recommendation: string;
    riskRanking: {
        severity: number;
        likelihood: number;
    };
}
