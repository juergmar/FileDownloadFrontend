import { FileType } from './file-generation.models';

/**
 * Base interface for all report requests
 */
export interface BaseReportRequest {
  type: FileType;
}

/**
 * User activity report request parameters
 */
export interface UserActivityReportRequest extends BaseReportRequest {
  type: FileType.USER_ACTIVITY_REPORT;
  startDate: number;
}

/**
 * System health report request parameters
 */
export interface SystemHealthReportRequest extends BaseReportRequest {
  type: FileType.SYSTEM_HEALTH_REPORT;
  includeDetailedMetrics: boolean;
}

/**
 * File statistics report request parameters
 */
export interface FileStatisticsReportRequest extends BaseReportRequest {
  type: FileType.FILE_STATISTICS_REPORT;
  includeHistoricalData: boolean;
}

/**
 * Custom report request parameters
 */
export interface CustomReportRequest extends BaseReportRequest {
  type: FileType.CUSTOM_REPORT;
  reportName: string;
}

/**
 * Union type for all report requests
 */
export type ReportRequest =
  | UserActivityReportRequest
  | SystemHealthReportRequest
  | FileStatisticsReportRequest
  | CustomReportRequest;

/**
 * Response from the generate file endpoint
 */
export interface GenerateFileResponse {
  jobId: string;
}
