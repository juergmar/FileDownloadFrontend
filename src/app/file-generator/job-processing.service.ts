import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription, timer, Observable, of } from 'rxjs';
import { takeUntil, finalize, catchError, takeWhile } from 'rxjs/operators';
import { MessageService } from 'primeng/api';

import { FileGenerationService } from './file-generation.service';
import { FileType, JobDTO, JobStatus, WebSocketMessage } from './file-generation.models';
import { ReportRequest } from './report-request.models';

@Injectable()
export class JobProcessingService implements OnDestroy {
  private readonly WEBSOCKET_TIMEOUT_MS: number = 30000;
  private readonly POLLING_INTERVAL_MS: number = 1000;

  private readonly destroy$: Subject<void> = new Subject<void>();
  private pollingSubscription?: Subscription;
  private wsSubscription?: Subscription;

  private _currentJob: JobDTO | null = null;
  private readonly jobUpdatesSubject: Subject<JobDTO> = new Subject<JobDTO>();

  public readonly jobUpdates$: Observable<JobDTO> = this.jobUpdatesSubject.asObservable();

  public constructor(
    private readonly fileGenerationService: FileGenerationService,
    private readonly messageService: MessageService
  ) {
    // Subscribe to WebSocket updates to catch updates for the current job
    this.subscribeToWebSocketUpdates();
  }

  public ngOnDestroy(): void {
    this.stopPolling();
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Subscribe to WebSocket updates for the current job
   */
  private subscribeToWebSocketUpdates(): void {
    this.wsSubscription = this.fileGenerationService.jobStatusUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: WebSocketMessage) => {
        // Only update if it's for the current job
        if (this._currentJob && this._currentJob.jobId === message.jobId) {
          this._currentJob = {
            ...this._currentJob,
            status: message.status,
            progress: message.progress,
            fileName: message.fileName,
            fileSize: message.fileSize,
            failureReason: message.errorMessage
          };

          this.jobUpdatesSubject.next(this._currentJob);
        }
      });
  }

  /**
   * Initiate processing of a new job
   * @param request The report request containing type and parameters
   * @returns Observable with job updates
   */
  public initiateJobProcessing(request: ReportRequest): Observable<JobDTO> {
    this._currentJob = {
      jobId: 'pending-' + Date.now(),
      fileType: request.type,
      status: JobStatus.PENDING,
      createdAt: new Date().toISOString(),
      fileDataAvailable: false
    };

    // Emit the initial job state
    this.jobUpdatesSubject.next(this._currentJob);

    this.fileGenerationService.generateFile(request)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this._currentJob = {
            ...(this._currentJob as JobDTO),
            status: JobStatus.FAILED,
            failureReason: err.error?.message || 'Failed to start file generation'
          };

          this.jobUpdatesSubject.next(this._currentJob);

          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to start file generation'
          });

          return of(null);
        })
      )
      .subscribe(response => {
        if (!response) return;

        // Update the job with the real ID
        this._currentJob = {
          ...(this._currentJob as JobDTO),
          jobId: response.jobId
        };

        // Emit the updated job
        this.jobUpdatesSubject.next(this._currentJob);

        this.fileGenerationService.subscribeToJobUpdates(response.jobId)
          .pipe(takeUntil(this.destroy$))
          .subscribe(success => {
            if (success) {
              console.log(`Successfully subscribed to updates for job: ${response.jobId}`);
            } else {
              console.warn(`Failed to subscribe via WebSocket, falling back to polling for job: ${response.jobId}`);
              // Ensure polling starts even if WebSocket subscription fails
              this.startPolling(response.jobId);
            }
          });

        // Setup WebSocket timeout as a fallback
        this.setupWebSocketTimeout(response.jobId);

        // Start polling as additional backup (using the recent jobs endpoint)
        this.startPolling(response.jobId);
      });

    return this.jobUpdates$;
  }

  /**
   * Retry a failed job
   * @param jobId ID of the job to retry
   * @param fileType Type of file to generate
   * @returns Observable with job updates
   */
  public retryJob(jobId: string, fileType: FileType): Observable<JobDTO> {
    // Create initial job with pending status
    this._currentJob = {
      jobId: 'pending-retry-' + Date.now(),
      fileType,
      status: JobStatus.PENDING,
      createdAt: new Date().toISOString(),
      fileDataAvailable: false
    };

    // Emit the initial job state
    this.jobUpdatesSubject.next(this._currentJob);

    this.fileGenerationService.retryJob(jobId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this._currentJob = {
            ...(this._currentJob as JobDTO),
            status: JobStatus.FAILED,
            failureReason: err.error?.message || 'Failed to retry the job'
          };

          this.jobUpdatesSubject.next(this._currentJob);

          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to retry the job'
          });

          return of(null);
        })
      )
      .subscribe(response => {
        if (!response) return;

        // Update job with real ID
        this._currentJob = {
          ...(this._currentJob as JobDTO),
          jobId: response.jobId
        };

        // Emit the updated job
        this.jobUpdatesSubject.next(this._currentJob);

        // Subscribe for job updates
        this.fileGenerationService.subscribeToJobUpdates(response.jobId)
          .pipe(takeUntil(this.destroy$))
          .subscribe(success => {
            if (success) {
              console.log(`Successfully subscribed to updates for retry job: ${response.jobId}`);
            } else {
              console.warn(`Failed to subscribe via WebSocket, falling back to polling for retry job: ${response.jobId}`);
              // Ensure polling starts even if WebSocket subscription fails
              this.startPolling(response.jobId);
            }
          });

        // Setup WebSocket timeout as a fallback
        this.setupWebSocketTimeout(response.jobId);

        this.messageService.add({
          severity: 'info',
          summary: 'Job Retried',
          detail: `New Job ID: ${response.jobId}`
        });
      });

    return this.jobUpdates$;
  }

  /**
   * Set up a timeout for WebSocket updates
   * @param jobId ID of the job to monitor
   */
  private setupWebSocketTimeout(jobId: string): void {
    let updatesReceived = false;

    const subscription = this.fileGenerationService.jobStatusUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        if (message.jobId === jobId) {
          updatesReceived = true;
        }
      });

    timer(this.WEBSOCKET_TIMEOUT_MS)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => subscription.unsubscribe())
      )
      .subscribe(() => {
        if (!updatesReceived && this._currentJob?.jobId === jobId) {
          console.log(`No WebSocket updates received for job ${jobId}. Relying on polling mechanism.`);

          this.messageService.add({
            severity: 'info',
            summary: 'Status Update',
            detail: 'Real-time updates not received. Using backup method for status updates.'
          });
        }
      });
  }

  /**
   * Start polling for job status
   * @param jobId ID of the job to poll
   */
  private startPolling(jobId: string): void {
    this.stopPolling();

    console.log(`Starting to poll for job ${jobId} status every ${this.POLLING_INTERVAL_MS}ms`);

    this.pollingSubscription = this.fileGenerationService.pollJobStatus(jobId, this.POLLING_INTERVAL_MS)
      .pipe(
        // Keep polling until the job reaches a terminal state
        takeWhile(job => job !== null &&
            ![JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status),
          true),
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error while polling job status:', error);
          return of(null);
        }),
        finalize(() => {
          console.log(`Polling for job ${jobId} has stopped`);
        })
      )
      .subscribe(job => {
        if (job) {
          console.log(`Poll update for job ${jobId}: status=${job.status}`);

          if (this._currentJob?.jobId === jobId) {
            // Update current job with latest status
            this._currentJob = {
              ...this._currentJob,
              ...job
            };

            this.jobUpdatesSubject.next(this._currentJob);

            // If job reached terminal state, stop polling
            if ([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status)) {
              console.log(`Job ${jobId} reached terminal state ${job.status} (via polling).`);
              this.stopPolling();
            }
          }
        }
      });
  }

  /**
   * Stop polling for job status
   */
  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }
}
