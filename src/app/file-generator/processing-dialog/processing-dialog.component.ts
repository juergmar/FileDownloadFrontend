import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { Subject } from 'rxjs';
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
  @Output() public dialogClosed: EventEmitter<void> = new EventEmitter<void>();

  public lastStatusCheckTime: Date = new Date();
  public isCheckingStatus: boolean = false;
  // Expose JobStatus enum to the template
  public JobStatus = JobStatus;

  private destroy$: Subject<void> = new Subject<void>();

  public ngOnInit(): void {
    // No auto-closing logic
  }

  public ngOnChanges(changes: SimpleChanges): void {
    // Update time whenever job changes
    if (changes['job']?.currentValue) {
      this.lastStatusCheckTime = new Date();
      this.isCheckingStatus = false;
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

  public isProcessing(): boolean {
    return this.job ?
      (this.job.status === JobStatus.PENDING || this.job.status === JobStatus.IN_PROGRESS) :
      true;
  }

  public shouldShowCloseButton(): boolean {
    // Only show close button when job is NOT in processing state
    return this.job ?
      !(this.job.status === JobStatus.PENDING || this.job.status === JobStatus.IN_PROGRESS) :
      false;
  }

  public shouldShowDownloadButton(): boolean {
    return this.job?.status === JobStatus.COMPLETED;
  }

  // Method to handle close button click
  public closeDialog(): void {
    // Only allow closing if job is not in processing state
    if (!this.isProcessing()) {
      this.visibleChange.emit(false);
      this.dialogClosed.emit();
    }
  }

  // New method to handle PrimeNG's built-in onHide event
  public handleDialogHide(): void {
    // Only proceed if job is not in processing state (which should be enforced by [closable])
    if (!this.isProcessing()) {
      this.dialogClosed.emit();
    }
  }
}
