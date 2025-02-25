import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
export class ProcessingDialogComponent implements OnChanges, OnInit, OnDestroy {
  @Input() public visible: boolean = false;
  @Input() public job: JobDTO | null = null;
  @Output() public visibleChange: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public download: EventEmitter<void> = new EventEmitter<void>();
  public lastStatusCheckTime: Date = new Date();
  public isCheckingStatus: boolean = false;
  // Expose JobStatus enum to the template
  public JobStatus = JobStatus;

  private destroy$: Subject<void> = new Subject<void>();
  // Track previous job status to prevent multiple timeouts
  private previousJobStatus: JobStatus | null = null;
  // Failsafe timer - close dialog after 2 minutes regardless of status
  private readonly MAX_DIALOG_DURATION_MS: number = 120000; // 2 minutes

  public ngOnInit(): void {
    // Setup failsafe timer to ensure dialog eventually closes
    if (this.visible) {
      this.setupFailsafeTimer();
    }
  }

  public ngOnChanges(changes: SimpleChanges): void {
    // If dialog becomes visible, start failsafe timer
    if (changes['visible'] && changes['visible'].currentValue === true
      && (!changes['visible'].previousValue || changes['visible'].previousValue === false)) {
      this.setupFailsafeTimer();
    }

    if (changes['job']?.currentValue) {
      this.lastStatusCheckTime = new Date();
      this.isCheckingStatus = false;
    }

    // If job status changes to a terminal state, close after delay
    if (changes['job']?.currentValue) {
      const currentJob = changes['job'].currentValue as JobDTO;

      // Only process status change if it's different from previous status
      if (currentJob.status !== this.previousJobStatus) {
        this.previousJobStatus = currentJob.status;

        if (currentJob.status === JobStatus.COMPLETED ||
          currentJob.status === JobStatus.FAILED ||
          currentJob.status === JobStatus.CANCELLED) {

          console.log(`Job ${currentJob.jobId} status changed to ${currentJob.status}. Closing dialog in 3s.`);

          // Use RxJS timer instead of setTimeout for better control
          timer(3000)
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
              console.log(`Closing dialog for job ${currentJob.jobId}`);
              this.closeDialog();
            });
        }
      }
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  // Explicit method for closing dialog
  private closeDialog(): void {
    if (this.visible) {
      this.visibleChange.emit(false);
    }
  }

  // Setup a failsafe timer to ensure dialog closes even if WebSocket updates fail
  private setupFailsafeTimer(): void {
    timer(this.MAX_DIALOG_DURATION_MS)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('Failsafe timer triggered - closing dialog');
        this.closeDialog();

        // If job is still in progress, update UI to show potential issue
        if (this.job && (this.job.status === JobStatus.PENDING || this.job.status === JobStatus.IN_PROGRESS)) {
          // You could emit an event to the parent to show a notification
        }
      });
  }
}
