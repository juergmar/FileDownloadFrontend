import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

// Components
import { ProcessingDialogComponent } from './processing-dialog/processing-dialog.component';

// Services and Models
import { FileGenerationService } from './file-generation.service';
import { FileType, JobDTO, JobStatus, WebSocketMessage } from './file-generation.models';
import {FileGeneratorFormComponent} from './file-generator-form.component';
import {JobListComponent} from './job-list.component';

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
  providers: [MessageService, ConfirmationService],
  templateUrl: './file-generator.component.html',
  styleUrls: ['./file-generator.component.scss']
})
export class FileGeneratorComponent implements OnInit, OnDestroy {
  private fileGenerationService = inject(FileGenerationService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private destroy$: Subject<void> = new Subject<void>();

  public recentJobs: JobDTO[] = [];
  public loading: boolean = false;
  public connectionStatus: boolean = false;

  // Variables for processing dialog
  public showProcessingDialog: boolean = false;
  public currentProcessingJob: JobDTO | null = null;

  public ngOnInit(): void {
    this.loadRecentJobs();
    this.subscribeToWebSocketUpdates();

    // Monitor connection status
    this.fileGenerationService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.connectionStatus = connected;
      });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public onGenerateFile(data: { fileType: FileType, parameters?: Record<string, any> }): void {
    this.generateFile(data.fileType, data.parameters);
  }

  public onDownloadFile(jobId: string): void {
    this.downloadFile(jobId);
  }

  public onCancelJob(jobId: string): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to cancel this job?',
      accept: () => this.cancelJob(jobId)
    });
  }

  public onRetryJob(jobId: string): void {
    this.retryJob(jobId);
  }

  public onJobsRefresh(): void {
    this.loadRecentJobs();
  }

  private loadRecentJobs(): void {
    this.loading = true;
    this.fileGenerationService.getRecentJobs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (jobs) => {
          this.recentJobs = jobs;
          this.loading = false;
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load recent jobs: ' + err.message
          });
          this.loading = false;
        }
      });
  }

  private subscribeToWebSocketUpdates(): void {
    this.fileGenerationService.jobStatusUpdates$
        .pipe(takeUntil(this.destroy$))
        .subscribe((message: WebSocketMessage) => {
          // Update job in the list if it exists
          const jobIndex = this.recentJobs.findIndex(job => job.jobId === message.jobId);

          if (jobIndex >= 0) {
            const updatedJob = {
              ...this.recentJobs[jobIndex],
              status: message.status,
              progress: message.progress,
              fileName: message.fileName,
              fileSize: message.fileSize,
              failureReason: message.errorMessage
            };

            // Create a new array to trigger change detection
            this.recentJobs = [
              ...this.recentJobs.slice(0, jobIndex),
              updatedJob,
              ...this.recentJobs.slice(jobIndex + 1)
            ];

            // Update the current processing job if it matches
            if (this.currentProcessingJob && this.currentProcessingJob.jobId === message.jobId) {
              this.currentProcessingJob = updatedJob;

              // Only update visibility if job is in progress
              if (message.status === JobStatus.PENDING || message.status === JobStatus.IN_PROGRESS) {
                this.showProcessingDialog = true;
              }
            }

            // Show notifications for completed or failed jobs
            if (message.status === JobStatus.COMPLETED) {
              this.messageService.add({
                severity: 'success',
                summary: 'Job Completed',
                detail: `Your ${message.fileType} is ready for download.`
              });
            } else if (message.status === JobStatus.FAILED) {
              this.messageService.add({
                severity: 'error',
                summary: 'Job Failed',
                detail: message.errorMessage || 'An error occurred during file generation.'
              });
            }
          }
        });
  }

  private updateProcessingDialogVisibility(job: JobDTO): void {
    if (this.currentProcessingJob && this.currentProcessingJob.jobId === job.jobId) {
      // Only show dialog for jobs that are pending or in progress
      this.showProcessingDialog =
        job.status === JobStatus.PENDING || job.status === JobStatus.IN_PROGRESS;
    }
  }

  private generateFile(fileType: FileType, parameters?: Record<string, any>): void {
    this.fileGenerationService.generateFile(fileType, parameters)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            // Create a placeholder job object for the processing dialog
            this.currentProcessingJob = {
              jobId: response.jobId,
              fileType: fileType,
              status: JobStatus.PENDING,
              createdAt: new Date().toISOString(),
              fileDataAvailable: false
            };

            // Show the processing dialog immediately
            this.showProcessingDialog = true;

            // Subscribe to updates for this specific job
            this.fileGenerationService.subscribeToJobUpdates(response.jobId);

            // Refresh the jobs list
            this.loadRecentJobs();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to start file generation'
            });
          }
        });
  }


  public downloadFile(jobId: string): void {
    this.fileGenerationService.downloadFile(jobId).subscribe({
      next: (success) => {
        if (success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Download Started',
            detail: 'Your file is being downloaded.'
          });
        }
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Download Failed',
          detail: 'Failed to download the file: ' + (err.message || 'Unknown error')
        });
      }
    });
  }

  private cancelJob(jobId: string): void {
    this.fileGenerationService.cancelJob(jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'info',
            summary: 'Job Cancelled',
            detail: 'The job has been cancelled successfully.'
          });

          // Update job status in a reactive way
          const jobIndex = this.recentJobs.findIndex(j => j.jobId === jobId);
          if (jobIndex >= 0) {
            // Create a new array with the updated job to ensure change detection
            const updatedJobs = [...this.recentJobs];
            updatedJobs[jobIndex] = {
              ...updatedJobs[jobIndex],
              status: JobStatus.CANCELLED
            };
            this.recentJobs = updatedJobs;

            // Update processing dialog if needed
            if (this.currentProcessingJob && this.currentProcessingJob.jobId === jobId) {
              this.currentProcessingJob = {
                ...this.currentProcessingJob,
                status: JobStatus.CANCELLED
              };
              this.updateProcessingDialogVisibility(this.currentProcessingJob);
            }
          }
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to cancel the job'
          });
        }
      });
  }

  private retryJob(jobId: string): void {
    this.fileGenerationService.retryJob(jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Create a placeholder job object for the processing dialog
          const jobToRetry = this.recentJobs.find(job => job.jobId === jobId);

          if (jobToRetry) {
            this.currentProcessingJob = {
              jobId: response.jobId,
              fileType: jobToRetry.fileType,
              status: JobStatus.PENDING,
              createdAt: new Date().toISOString(),
              fileDataAvailable: false
            };

            // Show the processing dialog
            this.showProcessingDialog = true;
          }

          this.messageService.add({
            severity: 'info',
            summary: 'Job Retried',
            detail: `New Job ID: ${response.jobId}`
          });

          // Subscribe to updates for this new job
          this.fileGenerationService.subscribeToJobUpdates(response.jobId);

          // Refresh the jobs list
          this.loadRecentJobs();
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to retry the job'
          });
        }
      });
  }

  public downloadCurrentProcessingFile(): void {
    if (this.currentProcessingJob && this.currentProcessingJob.jobId) {
      this.downloadFile(this.currentProcessingJob.jobId);
    }
  }
}
