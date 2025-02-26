import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  BehaviorSubject,
  of,
  switchMap,
  timer,
  tap,
  filter,
  first,
  timeout,
  catchError,
  map
} from 'rxjs';

import {
  FileType,
  JobDTO,
  WebSocketMessage,
  JobSubscriptionRequest,
  PagedJobResponse
} from './file-generation.models';
import { ReportRequest, GenerateFileResponse } from './report-request.models';
import { RxStompService } from './rx-stomp.service';
import { RxStompState } from '@stomp/rx-stomp';
import { FileGeneratorApiService } from './file-generator-api.service';

const CONNECTION_TIMEOUT = 10000; // 10 seconds

@Injectable({
  providedIn: 'root'
})
export class FileGenerationService {
  private readonly jobUpdatesSubject: Subject<WebSocketMessage> = new Subject<WebSocketMessage>();
  private readonly connectionStatusSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public readonly jobStatusUpdates$: Observable<WebSocketMessage> = this.jobUpdatesSubject.asObservable();
  public readonly connectionStatus$: Observable<boolean> = this.connectionStatusSubject.asObservable();

  public constructor(
    private readonly rxStompService: RxStompService,
    private readonly apiService: FileGeneratorApiService
  ) {
    this.rxStompService.connectionState$.subscribe(state => {
      this.connectionStatusSubject.next(state === RxStompState.OPEN);
    });
  }

  /**
   * Poll for job status at regular intervals
   * @param jobId ID of the job to poll
   * @param intervalMs Polling interval in milliseconds
   * @returns Observable with the job info on each poll
   */
  public pollJobStatus(jobId: string, intervalMs: number = 3000): Observable<JobDTO | null> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getJobFromRecent(jobId)),
      tap(job => {
        if (job) {
          const update: WebSocketMessage = {
            jobId: job.jobId,
            fileType: job.fileType,
            status: job.status,
            progress: job.progress,
            updatedAt: new Date().toISOString(),
            fileName: job.fileName,
            fileSize: job.fileSize,
            errorMessage: job.failureReason
          };
          this.jobUpdatesSubject.next(update);
        }
      }),
      catchError(error => {
        console.error('Error polling job status:', error);
        return of(null);
      })
    );
  }

  /**
   * Get a job status by finding it in the recent jobs list
   * @param jobId ID of the job to find
   * @returns Observable with the job info if found
   */
  private getJobFromRecent(jobId: string): Observable<JobDTO | null> {
    return this.apiService.getRecentJobs().pipe(
      map(response => response.jobs.find(job => job.jobId === jobId) || null),
      catchError(error => {
        console.error(`Error fetching job info for job ${jobId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Subscribe to updates for a specific job via WebSocket
   * @param jobId ID of the job to subscribe to
   * @returns Observable indicating subscription success
   */
  public subscribeToJobUpdates(jobId: string): Observable<boolean> {
    return this.rxStompService.ensureConnected().pipe(
      tap(connected => {
        if (!connected) {
          console.warn(`WebSocket not connected, subscription to job ${jobId} will be delayed or may fail`);
        } else {
          console.log(`WebSocket connected, subscribing to updates for job: ${jobId}`);
        }
      }),
      filter(connected => connected),
      tap(() => {
        const subscription = this.rxStompService.watch(`/user/queue/job-updates/${jobId}`);
        subscription.subscribe({
          next: message => {
            try {
              const update = JSON.parse(message.body) as WebSocketMessage;
              console.log(`Received job update for ${jobId}:`, update);
              this.jobUpdatesSubject.next(update);
            } catch (e) {
              console.error(`Error parsing job update message for ${jobId}:`, e);
            }
          },
          error: err => console.error(`WebSocket subscription error for job ${jobId}:`, err)
        });

        // Send subscription request
        const subscriptionRequest: JobSubscriptionRequest = { jobId };
        this.rxStompService.publish({
          destination: '/app/subscribe-job',
          body: JSON.stringify(subscriptionRequest)
        });

        console.log(`Successfully subscribed to updates for job: ${jobId}`);
      }),
      map(() => true),
      catchError(err => {
        console.error(`Failed to subscribe to job ${jobId} updates:`, err);
        return of(false);
      })
    );
  }

  /**
   * Generate a new file
   * @param request The report request containing type and parameters
   * @returns Observable with the job details
   */
  public generateFile(request: ReportRequest): Observable<GenerateFileResponse> {
    return this.apiService.generateFile(request);
  }

  /**
   * Get recent jobs with pagination
   * @param page Page number (0-based)
   * @param size Page size
   * @returns Observable with paginated jobs
   */
  public getRecentJobs(page: number = 0, size: number = 10): Observable<PagedJobResponse> {
    return this.apiService.getRecentJobs(page, size);
  }

  /**
   * Download a generated file
   * This method triggers a true file download by writing the file to disk
   * @param jobId ID of the job to download
   * @returns Observable indicating download success
   */
  public downloadFile(jobId: string): Observable<boolean> {
    return new Observable<boolean>(observer => {
      this.apiService.downloadFile(jobId).subscribe({
        next: (response) => {
          // Extract filename from Content-Disposition header or use a default
          let filename = `report-${jobId}.csv`;
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches != null && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          }

          // Create a blob URL
          const blob = response.body;
          if (!blob) {
            observer.error('No file content received');
            return;
          }

          // Set content type if available
          const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
          const blobWithType = new Blob([blob], { type: contentType });

          // Create download link and trigger download
          this.saveFile(blobWithType, filename);
          observer.next(true);
          observer.complete();
        },
        error: (err) => {
          console.error('Error downloading file', err);
          observer.error(err);
        }
      });
    });
  }

  /**
   * Helper method to save a file to disk
   * @param blob Blob containing the file data
   * @param filename Name to save the file as
   */
  private saveFile(blob: Blob, filename: string): void {
    // Create a blob URL
    const url = window.URL.createObjectURL(blob);

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);

    // Programmatically click the link to trigger the download
    link.click();

    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }

  /**
   * Cancel a job
   * @param jobId ID of the job to cancel
   * @returns Observable indicating cancellation success
   */
  public cancelJob(jobId: string): Observable<{ cancelled: boolean }> {
    return this.apiService.cancelJob(jobId);
  }

  /**
   * Retry a failed job
   * @param jobId ID of the job to retry
   * @returns Observable with the new job details
   */
  public retryJob(jobId: string): Observable<GenerateFileResponse> {
    return this.apiService.retryJob(jobId);
  }
}
