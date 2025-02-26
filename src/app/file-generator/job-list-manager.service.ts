import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';

import { FileGenerationService } from './file-generation.service';
import { JobDTO, JobStatus, WebSocketMessage } from './file-generation.models';

export interface JobPagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

@Injectable()
export class JobListManagerService implements OnDestroy {
  private jobs: JobDTO[] = [];
  private readonly destroy$: Subject<void> = new Subject<void>();
  private readonly jobsSubject: BehaviorSubject<JobDTO[]> = new BehaviorSubject<JobDTO[]>([]);
  private readonly loadingSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private readonly paginationSubject: BehaviorSubject<JobPagination> = new BehaviorSubject<JobPagination>({
    currentPage: 0,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  });

  private readonly STANDARD_REFRESH_INTERVAL: number = 15000;
  private readonly ACTIVE_JOB_REFRESH_INTERVAL: number = 5000;
  private readonly LOADING_MIN_DURATION: number = 300;
  private refreshSubscription?: Subscription;

  public readonly jobs$: Observable<JobDTO[]> = this.jobsSubject.asObservable();
  public readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();
  public readonly pagination$: Observable<JobPagination> = this.paginationSubject.asObservable();

  public constructor(
    private readonly fileGenerationService: FileGenerationService,
    private readonly messageService: MessageService
  ) {
    this.subscribeToJobUpdates();
    this.startAutoRefresh();
  }

  public ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Change current page
   * @param event Page event from paginator
   */
  public onPageChange(event: any): void {
    const pagination = this.paginationSubject.getValue();
    const newPage = event.page;
    const newSize = event.rows;

    // Only load if page or size changed
    if (pagination.currentPage !== newPage || pagination.pageSize !== newSize) {
      this.paginationSubject.next({
        ...pagination,
        currentPage: newPage,
        pageSize: newSize
      });

      // Load jobs with new pagination
      this.loadJobs(true);
    }
  }

  /**
   * Manually load the job list - will emit to subscribers
   * @param showLoading Whether to show the loading indicator
   */
  public loadJobs(showLoading: boolean = true): void {
    if (showLoading) {
      this.loadingSubject.next(true);
    }

    const loadingStartTime = Date.now();
    const pagination = this.paginationSubject.getValue();

    this.fileGenerationService.getRecentJobs(pagination.currentPage, pagination.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update jobs with a smart merge to preserve existing data when possible
          this.smartUpdateJobs(response.jobs);

          // Update pagination information
          this.paginationSubject.next({
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: response.totalItems,
            totalPages: response.totalPages
          });

          // Ensure loading indicator stays visible for minimum duration to prevent flashing
          const loadingElapsed = Date.now() - loadingStartTime;
          if (showLoading && loadingElapsed < this.LOADING_MIN_DURATION) {
            setTimeout(() => {
              this.loadingSubject.next(false);
            }, this.LOADING_MIN_DURATION - loadingElapsed);
          } else if (showLoading) {
            this.loadingSubject.next(false);
          }
        },
        error: (err) => {
          console.error('Error loading jobs:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load recent jobs: ' + (err.message || 'Unknown error')
          });
          if (showLoading) {
            this.loadingSubject.next(false);
          }
        }
      });
  }

  /**
   * Smart update of jobs to preserve UI state when possible
   * @param newJobs New jobs to merge with existing jobs
   */
  private smartUpdateJobs(newJobs: JobDTO[]): void {
    // Create a map of existing jobs for easy lookup
    const existingJobsMap = new Map<string, JobDTO>();
    this.jobs.forEach(job => existingJobsMap.set(job.jobId, job));

    this.jobs = newJobs.map(newJob => {
      const existingJob = existingJobsMap.get(newJob.jobId);
      if (existingJob) {
        if (existingJob.status === newJob.status &&
          existingJob.progress === newJob.progress &&
          existingJob.fileName === newJob.fileName) {
          return existingJob;
        } else {
          return {...existingJob, ...newJob};
        }
      } else {
        return newJob;
      }
    });

    this.jobsSubject.next(this.jobs);
  }

  /**
   * Start automatic refresh of job list
   */
  private startAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }

    this.loadJobs();

    this.refreshSubscription = timer(this.STANDARD_REFRESH_INTERVAL, this.STANDARD_REFRESH_INTERVAL)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.hasActiveJobs()) {
          if (this.refreshSubscription) {
            this.refreshSubscription.unsubscribe();
          }

          this.refreshSubscription = timer(0, this.ACTIVE_JOB_REFRESH_INTERVAL)
            .pipe(
              takeUntil(this.destroy$)
            )
            .subscribe(() => {
              this.loadJobs(false);

              if (!this.hasActiveJobs()) {
                if (this.refreshSubscription) {
                  this.refreshSubscription.unsubscribe();
                }
                this.startAutoRefresh();
              }
            });
        } else {
          this.loadJobs(false);
        }
      });
  }

  /**
   * Check if there are any active jobs that need more frequent updates
   * @returns True if there are active jobs
   */
  private hasActiveJobs(): boolean {
    return this.jobs.some(job =>
      job.status === JobStatus.PENDING ||
      job.status === JobStatus.IN_PROGRESS
    );
  }

  /**
   * Download a file by job ID
   * @param jobId ID of the job to download
   */
  public downloadFile(jobId: string): void {
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
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download Failed',
            detail: 'Failed to download the file: ' + (err.message || 'Unknown error')
          });
        }
      });
  }

  /**
   * Cancel a job by ID
   * @param jobId ID of the job to cancel
   */
  public cancelJob(jobId: string): void {
    this.fileGenerationService.cancelJob(jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.updateJobStatus(jobId, JobStatus.CANCELLED);
          this.messageService.add({
            severity: 'info',
            summary: 'Job Cancelled',
            detail: 'The job has been cancelled successfully.'
          });

          // Refresh the job list to get the latest status
          this.loadJobs(false);
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

  /**
   * Get a job by its ID
   * @param jobId ID of the job to find
   * @returns The job if found, undefined otherwise
   */
  public getJobById(jobId: string): JobDTO | undefined {
    return this.jobs.find(job => job.jobId === jobId);
  }

  /**
   * Update a job status and details in the job list
   * @param jobId ID of the job to update
   * @param status New status for the job
   * @param update Additional job properties to update
   */
  private updateJobStatus(jobId: string, status: JobStatus, update?: Partial<JobDTO>): void {
    const index = this.jobs.findIndex(j => j.jobId === jobId);

    if (index > -1) {
      // Create a new array with the updated job
      const updatedJobs = [...this.jobs];
      updatedJobs[index] = {...updatedJobs[index], status, ...update};
      this.jobs = updatedJobs;
      this.jobsSubject.next(this.jobs);
    } else {
      // If the job isn't in our list, refresh to ensure we have the latest data
      // but don't show loading indicator for a smoother experience
      this.loadJobs(false);
    }
  }

  /**
   * Subscribe to WebSocket job updates
   */
  private subscribeToJobUpdates(): void {
    this.fileGenerationService.jobStatusUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: WebSocketMessage) => {
        this.updateJobStatus(message.jobId, message.status, {
          progress: message.progress,
          fileName: message.fileName,
          fileSize: message.fileSize,
          failureReason: message.errorMessage
        });

        // For important state changes, refresh the full job list but without showing loading
        if (
          message.status === JobStatus.COMPLETED ||
          message.status === JobStatus.FAILED ||
          message.status === JobStatus.CANCELLED
        ) {
          this.loadJobs(false);
        }
      });
  }

  /**
   * Add or update a job in the list
   * @param job The job to add or update
   */
  /**
   * Add or update a job in the list
   * @param job The job to add or update
   * @param isRealJob Whether this is a real job (not a temporary one)
   */
  public addOrUpdateJob(job: JobDTO, isRealJob: boolean = false): void {
    // If this is a real job, remove any temporary jobs first
    if (isRealJob) {
      this.removeTemporaryJobs();
    }

    const index = this.jobs.findIndex(j => j.jobId === job.jobId);

    if (index > -1) {
      // Only update if something changed
      if (
        this.jobs[index].status !== job.status ||
        this.jobs[index].progress !== job.progress ||
        this.jobs[index].fileName !== job.fileName
      ) {
        const updatedJobs = [...this.jobs];
        updatedJobs[index] = {...updatedJobs[index], ...job};
        this.jobs = updatedJobs;
        this.jobsSubject.next(this.jobs);
      }
    } else {
      // Add new job to the beginning of the list
      this.jobs = [job, ...this.jobs];
      this.jobsSubject.next(this.jobs);
    }
  }


  /**
   * Remove a job from the list by ID
   * @param jobId ID of the job to remove
   */
  public removeJob(jobId: string): void {
    const index = this.jobs.findIndex(job => job.jobId === jobId);
    if (index > -1) {
      const updatedJobs = [...this.jobs];
      updatedJobs.splice(index, 1);
      this.jobs = updatedJobs;
      this.jobsSubject.next(this.jobs);
    }
  }

  /**
   * Remove all temporary jobs (jobs with IDs starting with 'pending-')
   */
  public removeTemporaryJobs(): void {
    const updatedJobs = this.jobs.filter(job => !job.jobId.startsWith('pending-'));
    if (updatedJobs.length !== this.jobs.length) {
      this.jobs = updatedJobs;
      this.jobsSubject.next(this.jobs);
    }
  }

}
