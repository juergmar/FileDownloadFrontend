import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG & Components
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProcessingDialogComponent } from './processing-dialog/processing-dialog.component';
import { FileGeneratorFormComponent } from './file-generator-form.component';
import { JobListComponent } from './job-list.component';

// Services & Models
import { FileGenerationService } from './file-generation.service';
import { FileType, JobDTO } from './file-generation.models';
import { JobProcessingService } from './job-processing.service';
import { JobListManagerService, JobPagination } from './job-list-manager.service';
import { ReportRequest } from './report-request.models';

@Component({
  selector: 'app-file-generator',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ToastModule,
    ConfirmDialogModule,
    ProcessingDialogComponent,
    FileGeneratorFormComponent,
    JobListComponent
  ],
  providers: [
    MessageService,
    ConfirmationService,
    JobProcessingService,
    JobListManagerService
  ],
  templateUrl: './file-generator.component.html',
  styleUrls: ['./file-generator.component.scss']
})
export class FileGeneratorComponent implements OnInit, OnDestroy {
  private fileGenerationService = inject(FileGenerationService);
  private confirmationService = inject(ConfirmationService);
  private jobProcessingService = inject(JobProcessingService);
  private jobListManagerService = inject(JobListManagerService);

  private destroy$ = new Subject<void>();

  public recentJobs: JobDTO[] = [];
  public loading = false;
  public connectionStatus = false;
  public currentProcessingJob: JobDTO | null = null;
  public showProcessingDialog = false;
  public pagination: JobPagination = {
    currentPage: 0,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  };

  public ngOnInit(): void {
    // Load jobs and setup subscriptions
    this.jobListManagerService.loadJobs();

    this.jobListManagerService.jobs$
      .pipe(takeUntil(this.destroy$))
      .subscribe(jobs => {
        this.recentJobs = jobs;
      });

    this.jobListManagerService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.loading = loading;
      });

    this.jobListManagerService.pagination$
      .pipe(takeUntil(this.destroy$))
      .subscribe(pagination => {
        this.pagination = pagination;
      });

    // Subscribe to connection status
    this.fileGenerationService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.connectionStatus = connected;
      });

    // Subscribe to current job processing updates
    this.jobProcessingService.jobUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(job => {
        // Always update the current job
        this.currentProcessingJob = job;

        // If job exists, show dialog
        if (job) {
          this.showProcessingDialog = true;

          // Check if this job has a real ID (not a temporary one)
          const isRealJob = !job.jobId.startsWith('pending-');

          // Update the job list
          this.jobListManagerService.addOrUpdateJob(job, isRealJob);
        }
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle generate file request from form
   * @param request The report request
   */
  public onGenerateFile(request: ReportRequest): void {
    this.jobProcessingService.initiateJobProcessing(request);
  }

  public onDownloadFile(jobId: string): void {
    this.jobListManagerService.downloadFile(jobId);
  }

  public onCancelJob(jobId: string): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to cancel this job?',
      accept: () => {
        this.jobListManagerService.cancelJob(jobId);
      }
    });
  }

  public onRetryJob(jobId: string): void {
    const job = this.jobListManagerService.getJobById(jobId);
    if (job) {
      this.jobProcessingService.retryJob(jobId, job.fileType);
    }
  }

  public onJobsRefresh(): void {
    this.jobListManagerService.loadJobs();
  }

  public onPageChange(event: any): void {
    this.jobListManagerService.onPageChange(event);
  }

  public downloadCurrentProcessingFile(): void {
    if (this.currentProcessingJob) {
      this.onDownloadFile(this.currentProcessingJob.jobId);
    }
  }

  public onProcessingDialogClosed(): void {
    // This method is called regardless of how the dialog was closed
    // (via the Close button, X icon, or Escape key)
    this.currentProcessingJob = null;
  }
}
