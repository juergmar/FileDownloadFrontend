// file-generation.service.ts
import {Injectable, NgZone} from '@angular/core';
import {Observable, of, Subject, tap} from 'rxjs';
import {FileGeneratorApiService} from './file-generator-api.service';
import {JobDTO, JobSubscriptionRequest, PagedJobResponse, WebSocketMessage} from '../models/file-generation.models';
import {GenerateFileResponse, ReportRequest} from '../models/report-request.models';
import {MessageService} from 'primeng/api';
import {RxStompService} from '../../../core/services/rx-stomp.service';

@Injectable({
  providedIn: 'root'
})
export class FileGenerationService {
  private readonly jobUpdatesSubject = new Subject<WebSocketMessage>();
  public readonly jobStatusUpdates$ = this.jobUpdatesSubject.asObservable();

  // Track active jobs
  private activeJobs = new Set<string>();

  constructor(
    private readonly rxStompService: RxStompService,
    private readonly apiService: FileGeneratorApiService,
    private readonly messageService: MessageService,
    private readonly ngZone: NgZone
  ) {
    // Initialize connection status monitoring
    this.monitorConnectionStatus();
  }

  /**
   * Simple connection monitoring
   */
  private monitorConnectionStatus(): void {
    this.rxStompService.connectionStatus$.subscribe(connected => {
      if (!connected) {
        console.warn('WebSocket connection lost or not established');
      }
    });
  }

  /**
   * Subscribe to job updates with better error handling
   */
  public subscribeToJobUpdates(jobId: string): Observable<boolean> {
    // Already tracking this job
    if (this.activeJobs.has(jobId)) {
      return of(true);
    }

    this.activeJobs.add(jobId);

    try {
      // Create the subscription
      const jobUpdates$ = this.rxStompService.watch(`/user/queue/job-updates/${jobId}`);
      const subscription = jobUpdates$.subscribe({
        next: message => {
          try {
            const update = JSON.parse(message.body) as WebSocketMessage;

            // Use NgZone to ensure Angular change detection
            this.ngZone.run(() => {
              this.jobUpdatesSubject.next(update);
            });

            // Cleanup on terminal state
            if (this.isJobCompleted(update.status)) {
              this.activeJobs.delete(jobId);
              subscription.unsubscribe();
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        },
        error: error => {
          console.error('WebSocket subscription error:', error);
          this.activeJobs.delete(jobId);

          // Fallback to polling for this job
          this.fallbackToPolling(jobId);
        }
      });

      // Register with the server
      this.sendSubscriptionRequest(jobId);
      return of(true);
    } catch (error) {
      console.error('Error setting up WebSocket subscription:', error);
      this.activeJobs.delete(jobId);

      // Fallback to polling
      this.fallbackToPolling(jobId);
      return of(false);
    }
  }

  /**
   * Simple method to send the subscription request to the server
   */
  private sendSubscriptionRequest(jobId: string): void {
    try {
      const request: JobSubscriptionRequest = { jobId };
      this.rxStompService.publish({
        destination: '/app/subscribe-job',
        body: JSON.stringify(request)
      });
    } catch (error) {
      console.error('Error sending subscription request:', error);
      // We'll continue with the subscription anyway, as the server might still send updates
    }
  }

  /**
   * Simple polling fallback that checks job status every few seconds
   */
  private fallbackToPolling(jobId: string): void {
    if (!this.activeJobs.has(jobId)) {
      return; // Don't poll if we're not tracking this job anymore
    }

    console.log(`Falling back to polling for job ${jobId}`);
    this.messageService.add({
      severity: 'info',
      summary: 'Connection Notice',
      detail: 'Using polling for job updates (WebSocket unavailable)',
      life: 5000
    });

    // Check job status immediately and then every 3 seconds
    const checkStatus = () => {
      if (!this.activeJobs.has(jobId)) {
        return; // Stop polling if we're not tracking this job anymore
      }

      this.apiService.getJob(jobId).subscribe({
        next: job => {
          // Create an update message from the job status
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

          // Stop polling when the job is complete
          if (this.isJobCompleted(job.status)) {
            this.activeJobs.delete(jobId);
          } else {
            // Continue polling
            setTimeout(checkStatus, 3000);
          }
        },
        error: err => {
          console.error('Error polling job status:', err);
          // Try again after a delay
          setTimeout(checkStatus, 5000);
        }
      });
    };

    // Start polling
    checkStatus();
  }

  /**
   * Check if a job is in a completed state (success, failure, or cancelled)
   */
  private isJobCompleted(status: string): boolean {
    return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
  }

  /**
   * Generate a new file
   */
  public generateFile(request: ReportRequest): Observable<GenerateFileResponse> {
    return this.apiService.generateFile(request).pipe(
      tap(response => {
        if (response && response.jobId) {
          // Try to subscribe to WebSocket updates, with fallback
          this.subscribeToJobUpdates(response.jobId);
        }
      })
    );
  }

  /**
   * Get recent jobs
   */
  public getRecentJobs(page: number = 0, size: number = 10): Observable<PagedJobResponse> {
    return this.apiService.getRecentJobs(page, size).pipe(
      tap(response => {
        // Auto-subscribe to in-progress jobs
        if (response && response.jobs) {
          response.jobs
            .filter(job => ['PENDING', 'IN_PROGRESS'].includes(job.status))
            .forEach(job => {
              this.subscribeToJobUpdates(job.jobId);
            });
        }
      })
    );
  }

  /**
   * Get a single job by ID
   */
  public getJob(jobId: string): Observable<JobDTO> {
    return this.apiService.getJob(jobId).pipe(
      tap(job => {
        // Auto-subscribe to updates if job is in progress
        if (job && ['PENDING', 'IN_PROGRESS'].includes(job.status)) {
          this.subscribeToJobUpdates(job.jobId);
        }
      })
    );
  }

  /**
   * Download a generated file
   */
  public downloadFile(jobId: string): Observable<boolean> {
    return new Observable<boolean>(observer => {
      this.apiService.downloadFile(jobId).subscribe({
        next: (response) => {
          // Extract filename from Content-Disposition header if available
          let filename = `report-${jobId}.csv`;
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches != null && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          }

          // Get blob from response
          const blob = response.body;
          if (!blob) {
            observer.error('No file content received');
            return;
          }

          // Set correct content type
          const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
          const blobWithType = new Blob([blob], { type: contentType });

          // Save file to disk
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
   * Cancel a job
   */
  public cancelJob(jobId: string): Observable<{ cancelled: boolean }> {
    return this.apiService.cancelJob(jobId);
  }

  /**
   * Retry a failed job
   */
  public retryJob(jobId: string): Observable<GenerateFileResponse> {
    return this.apiService.retryJob(jobId).pipe(
      tap(response => {
        if (response && response.jobId) {
          this.subscribeToJobUpdates(response.jobId);
        }
      })
    );
  }

  /**
   * Helper method to save a file to disk
   */
  private saveFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }
}
