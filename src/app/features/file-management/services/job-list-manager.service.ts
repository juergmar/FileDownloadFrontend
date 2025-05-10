import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';

import { FileGenerationService } from './file-generation.service';
import { JobDTO, JobStatus, WebSocketMessage } from '../models/file-generation.models';

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
  public readonly jobs$: Observable<JobDTO[]> = this.jobsSubject.asObservable();
  private readonly loadingSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();
  private readonly paginationSubject: BehaviorSubject<JobPagination> = new BehaviorSubject<JobPagination>({
    currentPage: 0,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0
  });
  public readonly pagination$: Observable<JobPagination> = this.paginationSubject.asObservable();

  // Duration to show loading indicator for better UX
  private readonly LOADING_MIN_DURATION: number = 300;

  public constructor(
    private readonly fileGenerationService: FileGenerationService,
    private readonly messageService: MessageService
  ) {}

  public ngOnDestroy(): void {
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

    if (pagination.currentPage !== newPage || pagination.pageSize !== newSize) {
      this.paginationSubject.next({
        ...pagination,
        currentPage: newPage,
        pageSize: newSize
      });

      this.loadJobs();
    }
  }

  /**
   * Manually load the job list - will emit to subscribers
   */
  public loadJobs(): void {
    this.loadingSubject.next(true);
    const loadingStartTime = Date.now();
    const pagination = this.paginationSubject.getValue();

    this.fileGenerationService.getRecentJobs(pagination.currentPage, pagination.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.jobs = response.jobs;
          this.jobsSubject.next(this.jobs);

          this.paginationSubject.next({
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: response.totalItems,
            totalPages: response.totalPages
          });

          const loadingElapsed = Date.now() - loadingStartTime;
          if (loadingElapsed < this.LOADING_MIN_DURATION) {
            setTimeout(() => {
              this.loadingSubject.next(false);
            }, this.LOADING_MIN_DURATION - loadingElapsed);
          } else {
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
          this.loadingSubject.next(false);
        }
      });
  }

  /**
   * Update job list when WebSocket message is received
   * @param message WebSocket message with job update
   */
  public updateJobWithWebSocketMessage(message: WebSocketMessage): void {
    // Find the job in our current list
    const index = this.jobs.findIndex(job => job.jobId === message.jobId);

    if (index > -1) {
      // Update existing job
      const updatedJobs = [...this.jobs];
      updatedJobs[index] = {
        ...updatedJobs[index],
        status: message.status as JobStatus,
        progress: message.progress,
        fileName: message.fileName,
        fileSize: message.fileSize,
        failureReason: message.errorMessage
      };

      this.jobs = updatedJobs;
      this.jobsSubject.next(this.jobs);
    } else {
      // If job not in list and we're on the first page, add it
      // This helps with new jobs that haven't been refreshed yet
      const pagination = this.paginationSubject.getValue();
      if (pagination.currentPage === 0 && !message.jobId.startsWith('pending-')) {
        // Get the job details
        this.fileGenerationService.getJob(message.jobId)
          .pipe(takeUntil(this.destroy$))
          .subscribe(job => {
            // Add to the beginning of the list
            this.jobs = [job, ...this.jobs];
            this.jobsSubject.next(this.jobs);
          });
      }
    }
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
   * Add a new job to the list or update existing one
   * @param job The job to add/update
   * @param isRealJob Whether this is a real job (not temporary)
   */
  public addOrUpdateJob(job: JobDTO, isRealJob: boolean = false): void {
    if (isRealJob) {
      // Remove any temporary jobs
      this.jobs = this.jobs.filter(j => !j.jobId.startsWith('pending-'));
    }

    const index = this.jobs.findIndex(j => j.jobId === job.jobId);

    if (index > -1) {
      // Update existing job
      const updatedJobs = [...this.jobs];
      updatedJobs[index] = job;
      this.jobs = updatedJobs;
    } else {
      // Add new job to the beginning
      this.jobs = [job, ...this.jobs];
    }

    this.jobsSubject.next(this.jobs);
  }
}
