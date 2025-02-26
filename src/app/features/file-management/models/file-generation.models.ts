export enum FileType {
  USER_ACTIVITY_REPORT = 'USER_ACTIVITY_REPORT',
  SYSTEM_HEALTH_REPORT = 'SYSTEM_HEALTH_REPORT',
  FILE_STATISTICS_REPORT = 'FILE_STATISTICS_REPORT',
  CUSTOM_REPORT = 'CUSTOM_REPORT'
}

export enum JobStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface JobDTO {
  jobId: string;
  fileType: FileType;
  status: JobStatus;
  progress?: number;
  createdAt: string;
  lastAccessed?: string;
  completedAt?: string;
  failureReason?: string;
  userId?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  fileDataAvailable: boolean;
}

export interface GenerateFileRequest {
  fileType: FileType;
  parameters?: Record<string, any>;
}

export interface GenerateFileResponse {
  jobId: string;
}

export interface JobStatusDTO {
  jobId: string;
  fileType: FileType;
  status: JobStatus;
  createdAt: string;
  lastAccessed?: string;
  completedAt?: string;
  failureReason?: string;
}

export interface JobSubscriptionRequest {
  jobId: string;
}

export interface WebSocketMessage {
  jobId: string;
  fileType: FileType;
  status: JobStatus;
  progress?: number;
  updatedAt: string;
  fileName?: string;
  fileSize?: number;
  errorMessage?: string;
}

export interface ServiceNotification {
  type: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  timestamp: string;
}

export interface PagedJobResponse {
  jobs: JobDTO[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
