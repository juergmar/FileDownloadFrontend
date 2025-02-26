import {Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DialogModule} from 'primeng/dialog';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {ButtonModule} from 'primeng/button';
import {Subject} from 'rxjs';

import {FileTypePipe} from '../../pipes/file-type.pipe';
import {JobDTO, JobStatus} from '../../models/file-generation.models';
import {JobStatusHelpers} from '../../utils/job-status.helpers';

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
  public JobStatus = JobStatus;

  private destroy$: Subject<void> = new Subject<void>();

  public ngOnInit(): void {
  }

  public ngOnChanges(changes: SimpleChanges): void {
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

  public isProcessing(): boolean {
    return this.job ?
      (this.job.status === JobStatus.PENDING || this.job.status === JobStatus.IN_PROGRESS) :
      true;
  }

  public shouldShowCloseButton(): boolean {
    return this.job ?
      !(this.job.status === JobStatus.PENDING || this.job.status === JobStatus.IN_PROGRESS) :
      false;
  }

  public shouldShowDownloadButton(): boolean {
    return this.job?.status === JobStatus.COMPLETED;
  }

  public closeDialog(): void {
    if (!this.isProcessing()) {
      this.visibleChange.emit(false);
      this.dialogClosed.emit();
    }
  }

  public handleDialogHide(): void {
    if (!this.isProcessing()) {
      this.dialogClosed.emit();
    }
  }
}
