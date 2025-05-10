import { JobStatus } from '../models/file-generation.models';


export class JobStatusHelpers {

  public static getSeverity(status: JobStatus): "success" | "secondary" | "info" | "warn" | "danger" {
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
