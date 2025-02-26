import {Pipe, PipeTransform} from '@angular/core';
import {JobStatus} from '../models/file-generation.models';

@Pipe({
  name: 'jobStatus',
  standalone: true
})
export class JobStatusPipe implements PipeTransform {
  public transform(value: JobStatus | undefined): string {
    if (!value) {
      return 'Unknown';
    }

    switch (value) {
      case JobStatus.PENDING:
        return 'Pending';
      case JobStatus.IN_PROGRESS:
        return 'In Progress';
      case JobStatus.COMPLETED:
        return 'Completed';
      case JobStatus.FAILED:
        return 'Failed';
      case JobStatus.CANCELLED:
        return 'Cancelled';
      default:
        return value;
    }
  }
}
