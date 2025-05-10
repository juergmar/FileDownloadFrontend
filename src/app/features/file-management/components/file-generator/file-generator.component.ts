// file-generator.component.ts
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FileGeneratorFormComponent } from './file-generator-form.component';
import { ProcessingDialogComponent } from '../processing-dialog/processing-dialog.component';
import { JobListComponent } from '../job-list/job-list.component';
import { JobListManagerService, JobPagination } from '../../services/job-list-manager.service';
import { FileGenerationService } from '../../services/file-generation.service';
import { JobDTO, JobStatus, WebSocketMessage } from '../../models/file-generation.models';
import { ReportRequest } from '../../models/report-request.models';

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
    JobListManagerService
  ],
  templateUrl: './file-generator.component.html',
  styleUrls: ['./file-generator.component.scss']
})
export class FileGeneratorComponent implements OnInit, OnDestroy {
  public recentJobs: JobDTO[] = [];
  public loading = false;
  public currentProcessingJob: JobDTO | null = null;
  public showProcessingDialog = false;
  public isGenerating = false;
  public pagination: JobPagination = {
    currentPage: 0,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  };

  private fileGenerationService = inject(FileGenerationService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private jobListManagerService = inject(JobListManagerService);
  private destroy$ = new Subject<void>();

  public ngOnInit(): void {
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

    // Subscribe to job status updates from FileGenerationService directly
    this.fileGenerationService.jobStatusUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        this.handleJobUpdate(update);
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle WebSocket job updates
   */
  private handleJobUpdate(update: WebSocketMessage): void {
    // First, update the job list
    this.jobListManagerService.updateJobWithWebSocketMessage(update);

    // Then, handle updates for the current job being processed
    if (this.currentProcessingJob && this.currentProcessingJob.jobId === update.jobId) {
      // Update the current processing job with new data
      this.currentProcessingJob = {
        ...this.currentProcessingJob,
        status: update.status as JobStatus,
        progress: update.progress,
        fileName: update.fileName,
        fileSize: update.fileSize,
        failureReason: update.errorMessage
      };

      // Job is complete (success, failure, or cancelled)
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(update.status)) {
        this.isGenerating = false;

        // Show appropriate message
        if (update.status === 'COMPLETED') {
          this.messageService.add({
            severity: 'success',
            summary: 'Report Generated',
            detail: 'Your report has been successfully generated.'
          });
        } else if (update.status === 'FAILED') {
          this.messageService.add({
            severity: 'error',
            summary: 'Generation Failed',
            detail: update.errorMessage || 'Report generation failed.'
          });
        }

        // Refresh job list to ensure we have the latest state
        this.jobListManagerService.loadJobs();
      }
    }
  }

  /**
   * Handle generate file request from form
   */
  public onGenerateFile(request: ReportRequest): void {
    this.isGenerating = true;

    // Create a temporary job for immediate UI feedback
    const tempJobId = 'pending-' + Date.now();
    const tempJob: JobDTO = {
      jobId: tempJobId,
      fileType: request.type,
      status: JobStatus.PENDING,
      createdAt: new Date().toISOString(),
      fileDataAvailable: false
    };

    // Show the processing dialog with the temporary job
    this.currentProcessingJob = tempJob;
    this.showProcessingDialog = true;

    // Start the actual file generation
    this.fileGenerationService.generateFile(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          // Update the temporary job with the real job ID
          this.currentProcessingJob = {
            ...tempJob,
            jobId: response.jobId,
            status: JobStatus.IN_PROGRESS
          };

          // Force refresh the job list to include the new job
          this.jobListManagerService.loadJobs();
        },
        error: err => {
          this.isGenerating = false;
          this.currentProcessingJob = {
            ...tempJob,
            status: JobStatus.FAILED,
            failureReason: err.error?.message || 'Failed to start file generation'
          };

          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to start file generation'
          });
        }
      });
  }

  public onDownloadFile(jobId: string): void {
    this.fileGenerationService.downloadFile(jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Download Started',
            detail: 'Your file is being downloaded.'
          });
        },
        error: err => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download Failed',
            detail: 'Failed to download the file: ' + (err.message || 'Unknown error')
          });
        }
      });
  }

  public onCancelJob(jobId: string): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to cancel this job?',
      accept: () => {
        this.fileGenerationService.cancelJob(jobId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              if (this.currentProcessingJob && this.currentProcessingJob.jobId === jobId) {
                this.currentProcessingJob = {
                  ...this.currentProcessingJob,
                  status: JobStatus.CANCELLED
                };
                this.isGenerating = false;
              }

              this.messageService.add({
                severity: 'info',
                summary: 'Job Cancelled',
                detail: 'The job has been cancelled successfully.'
              });

              // Refresh the list to get updated status
              this.jobListManagerService.loadJobs();
            },
            error: err => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: err.error?.message || 'Failed to cancel the job'
              });
            }
          });
      }
    });
  }

  public onRetryJob(jobId: string): void {
    const job = this.jobListManagerService.getJobById(jobId);
    if (job) {
      this.isGenerating = true;

      // Create a temporary job for immediate UI feedback
      const tempJobId = 'pending-retry-' + Date.now();
      const tempJob: JobDTO = {
        jobId: tempJobId,
        fileType: job.fileType,
        status: JobStatus.PENDING,
        createdAt: new Date().toISOString(),
        fileDataAvailable: false
      };

      // Show the processing dialog with the temporary job
      this.currentProcessingJob = tempJob;
      this.showProcessingDialog = true;

      // Start the actual job retry
      this.fileGenerationService.retryJob(jobId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: response => {
            // Update the temporary job with the real job ID
            this.currentProcessingJob = {
              ...tempJob,
              jobId: response.jobId,
              status: JobStatus.IN_PROGRESS
            };

            this.messageService.add({
              severity: 'info',
              summary: 'Job Retried',
              detail: `New Job ID: ${response.jobId}`
            });

            // Force refresh the job list to include the new job
            this.jobListManagerService.loadJobs();
          },
          error: err => {
            this.isGenerating = false;
            this.currentProcessingJob = {
              ...tempJob,
              status: JobStatus.FAILED,
              failureReason: err.error?.message || 'Failed to retry the job'
            };

            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to retry the job'
            });
          }
        });
    }
  }

  public onJobsRefresh(): void {
    this.jobListManagerService.loadJobs();
  }

  public onPageChange(event: any): void {
    this.jobListManagerService.onPageChange(event);
  }

  public downloadCurrentProcessingFile(): void {
    if (this.currentProcessingJob && this.currentProcessingJob.status === JobStatus.COMPLETED) {
      this.onDownloadFile(this.currentProcessingJob.jobId);
    }
  }

  public onProcessingDialogClosed(): void {
    this.showProcessingDialog = false;
    // Don't reset the currentProcessingJob immediately to avoid UI flicker
    setTimeout(() => {
      this.currentProcessingJob = null;
    }, 300);
  }
}
