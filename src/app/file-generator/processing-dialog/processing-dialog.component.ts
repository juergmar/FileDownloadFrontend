import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { Subject } from 'rxjs';
import { JobDTO, JobStatus } from '../file-generation.models';
import { JobStatusHelpers } from '../job-status.helpers';
import { FileTypePipe } from '../file-type.pipe';

@Component({
  selector: 'app-processing-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ProgressSpinnerModule,
    ButtonModule,
    FileTypePipe
  ],
  templateUrl: './processing-dialog.component.html',
  styleUrls: ['./processing-dialog.component.scss']
})
export class ProcessingDialogComponent implements OnChanges {
  @Input() public visible: boolean = false;
  @Input() public job: JobDTO | null = null;
  @Output() public visibleChange: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public download: EventEmitter<void> = new EventEmitter<void>();

  // Expose JobStatus enum to the template
  public JobStatus = JobStatus;

  private destroy$: Subject<void> = new Subject<void>();

  public ngOnChanges(changes: SimpleChanges): void {
    // If job status changes to something other than PENDING or IN_PROGRESS, close after delay
    if (changes['job']?.currentValue) {
      const currentJob = changes['job'].currentValue as JobDTO;
      if (currentJob.status === JobStatus.COMPLETED ||
        currentJob.status === JobStatus.FAILED ||
        currentJob.status === JobStatus.CANCELLED) {
        // Allow a small delay before closing to show the final state
        setTimeout(() => {
          this.visibleChange.emit(false);
        }, 3000); // Increased from 1500ms to 3000ms for better visibility
      }
    }
  }

  public getStatusMessage(): string {
    if (!this.job) {
      return 'Initializing...';
    }

    return JobStatusHelpers.getStatusMessage(this.job.status);
  }

  public shouldShowSpinner(): boolean {
    return this.job ?
      (this.job.status === JobStatus.PENDING || this.job.status === JobStatus.IN_PROGRESS) :
      true;
  }

  public getCompletionClass(): string {
    if (!this.job) return '';

    return JobStatusHelpers.getSeverity(this.job.status) || '';
  }

  public shouldShowCloseButton(): boolean {
    return this.job ?
      (this.job.status === JobStatus.COMPLETED ||
        this.job.status === JobStatus.FAILED ||
        this.job.status === JobStatus.CANCELLED) :
      false;
  }

  public shouldShowDownloadButton(): boolean {
    return this.job?.status === JobStatus.COMPLETED;
  }
}
