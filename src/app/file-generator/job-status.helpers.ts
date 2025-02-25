import {JobStatus} from './file-generation.models';

/**
 * Helper functions for working with job statuses
 */
export class JobStatusHelpers {
  /**
   * Get severity class for PrimeNG components based on job status
   */
  public static getSeverity(status: JobStatus): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status) {
      case JobStatus.COMPLETED:
        return 'success';
      case JobStatus.FAILED:
        return 'danger';
      case JobStatus.CANCELLED:
        return 'warn';
      case JobStatus.IN_PROGRESS:
      case JobStatus.PENDING:
        return 'info';
      default:
        return 'secondary';
    }
  }

  /**
   * Check if a job is currently in progress
   */
  public static isInProgress(status: JobStatus): boolean {
    return status === JobStatus.PENDING || status === JobStatus.IN_PROGRESS;
  }

  /**
   * Check if a job has completed (successfully or not)
   */
  public static isCompleted(status: JobStatus): boolean {
    return status === JobStatus.COMPLETED ||
      status === JobStatus.FAILED ||
      status === JobStatus.CANCELLED;
  }

  /**
   * Get human-readable status message
   */
  public static getStatusMessage(status: JobStatus): string {
    switch (status) {
      case JobStatus.PENDING:
        return 'Preparing to generate your report...';
      case JobStatus.IN_PROGRESS:
        return 'Generating your report...';
      case JobStatus.COMPLETED:
        return 'Your report is ready!';
      case JobStatus.FAILED:
        return 'Report generation failed';
      case JobStatus.CANCELLED:
        return 'Report generation was cancelled';
      default:
        return 'Processing...';
    }
  }
}
