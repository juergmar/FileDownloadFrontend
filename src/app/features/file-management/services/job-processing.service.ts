import {Injectable, OnDestroy} from '@angular/core';
import {Observable, of, Subject, Subscription} from 'rxjs';
import {catchError, takeUntil} from 'rxjs/operators';
import {MessageService} from 'primeng/api';

import {FileGenerationService} from './file-generation.service';
import {FileType, JobDTO, JobStatus, WebSocketMessage} from '../models/file-generation.models';
import {ReportRequest} from '../models/report-request.models';

@Injectable()
export class JobProcessingService implements OnDestroy {
  private readonly destroy$: Subject<void> = new Subject<void>();
  private wsSubscription?: Subscription;

  private _currentJob: JobDTO | null = null;
  private readonly jobUpdatesSubject: Subject<JobDTO> = new Subject<JobDTO>();

  public readonly jobUpdates$: Observable<JobDTO> = this.jobUpdatesSubject.asObservable();

  public constructor(
    private readonly fileGenerationService: FileGenerationService,
    private readonly messageService: MessageService
  ) {
    this.subscribeToWebSocketUpdates();
  }

  public ngOnDestroy(): void {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initiate processing of a new job
   * @param request The report request containing type and parameters
   * @returns Observable with job updates
   */
  public initiateJobProcessing(request: ReportRequest): Observable<JobDTO> {
    const temporaryJobId = 'pending-' + Date.now();
    this._currentJob = {
      jobId: temporaryJobId,
      fileType: request.type,
      status: JobStatus.PENDING,
      createdAt: new Date().toISOString(),
      fileDataAvailable: false
    };

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

        this._currentJob = {
          ...(this._currentJob as JobDTO),
          jobId: response.jobId,
          status: JobStatus.IN_PROGRESS
        };

        this.jobUpdatesSubject.next(this._currentJob);

        this.fileGenerationService.subscribeToJobUpdates(response.jobId)
          .pipe(takeUntil(this.destroy$))
          .subscribe(success => {
            if (!success) {
              // Inform the user that WebSocket connection failed
              this.messageService.add({
                severity: 'warn',
                summary: 'Connection Issue',
                detail: 'Unable to receive real-time updates. Please refresh to see job status changes.'
              });

              // Make a one-time request to get current job status
              this.fetchCurrentJobStatus(response.jobId);
            }
          });
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
    const temporaryJobId = 'pending-retry-' + Date.now();
    this._currentJob = {
      jobId: temporaryJobId,
      fileType,
      status: JobStatus.PENDING,
      createdAt: new Date().toISOString(),
      fileDataAvailable: false
    };

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

        this._currentJob = {
          ...(this._currentJob as JobDTO),
          jobId: response.jobId,
          status: JobStatus.IN_PROGRESS
        };

        this.jobUpdatesSubject.next(this._currentJob);

        this.fileGenerationService.subscribeToJobUpdates(response.jobId)
          .pipe(takeUntil(this.destroy$))
          .subscribe(success => {
            if (!success) {
              this.messageService.add({
                severity: 'warn',
                summary: 'Connection Issue',
                detail: 'Unable to receive real-time updates. Please refresh to see job status changes.'
              });

              // Make a one-time request to get current job status
              this.fetchCurrentJobStatus(response.jobId);
            }
          });

        this.messageService.add({
          severity: 'info',
          summary: 'Job Retried',
          detail: `New Job ID: ${response.jobId}`
        });
      });

    return this.jobUpdates$;
  }

  /**
   * Subscribe to WebSocket updates for the current job
   */
  private subscribeToWebSocketUpdates(): void {
    this.wsSubscription = this.fileGenerationService.jobStatusUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: WebSocketMessage) => {
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
   * Fetch current job status once (used when WebSocket fails)
   * @param jobId The job ID to fetch
   */
  private fetchCurrentJobStatus(jobId: string): void {
    this.fileGenerationService.getJob(jobId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error fetching job status:', error);
          return of(null);
        })
      )
      .subscribe(job => {
        if (job && this._currentJob?.jobId === jobId) {
          this._currentJob = {
            ...this._currentJob,
            ...job
          };
          this.jobUpdatesSubject.next(this._currentJob);
        }
      });
  }
}
