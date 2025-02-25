import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, map, catchError, of, switchMap, timer, tap } from 'rxjs';

import {
  FileType,
  JobDTO,
  GenerateFileRequest,
  GenerateFileResponse,
  WebSocketMessage,
  JobSubscriptionRequest,
  PagedJobResponse
} from './file-generation.models';
import { RxStompService } from './rx-stomp.service';
import { RxStompState } from '@stomp/rx-stomp';

@Injectable({
  providedIn: 'root'
})
export class FileGenerationService {
  private apiUrl: string = 'http://localhost:8080/api/files';
  private jobUpdatesSubject: Subject<WebSocketMessage> = new Subject<WebSocketMessage>();
  private connectionStatusSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  public jobStatusUpdates$: Observable<WebSocketMessage> = this.jobUpdatesSubject.asObservable();
  public connectionStatus$: Observable<boolean> = this.connectionStatusSubject.asObservable();

  constructor(
    private http: HttpClient,
    private rxStompService: RxStompService
  ) {
    this.rxStompService.connectionState$.subscribe(state => {
      this.connectionStatusSubject.next(state === RxStompState.OPEN);
    });
  }

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
   * This is a fallback since there's no direct status endpoint
   */
  private getJobFromRecent(jobId: string): Observable<JobDTO | null> {
    return this.getRecentJobs().pipe(
      map(response => response.jobs.find(job => job.jobId === jobId) || null),
      catchError(error => {
        console.error(`Error fetching job info for job ${jobId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Subscribe to updates for a specific job via WebSocket
   */
  public subscribeToJobUpdates(jobId: string): void {
    if (!this.connectionStatusSubject.value) {
      console.warn('WebSocket not connected, subscription might fail');
    }

    // Subscribe to job-specific updates
    const subscription = this.rxStompService.watch(`/user/queue/job-updates/${jobId}`);
    subscription.subscribe(message => {
      try {
        const update = JSON.parse(message.body) as WebSocketMessage;
        this.jobUpdatesSubject.next(update);
      } catch (e) {
        console.error('Error parsing job update message', e);
      }
    });

    // Send subscription request
    const subscriptionRequest: JobSubscriptionRequest = { jobId };
    this.rxStompService.publish({
      destination: '/app/subscribe-job',
      body: JSON.stringify(subscriptionRequest)
    });

    console.log(`Subscribed to updates for job: ${jobId}`);
  }

  /**
   * Generate a new file
   */
  public generateFile(fileType: FileType, parameters?: Record<string, any>): Observable<GenerateFileResponse> {
    const request: GenerateFileRequest = {
      fileType,
      parameters
    };
    return this.http.post<GenerateFileResponse>(`${this.apiUrl}/generate`, request);
  }

  /**
   * Get recent jobs with pagination
   * @param page Page number (0-based)
   * @param size Page size
   */
  public getRecentJobs(page: number = 0, size: number = 10): Observable<PagedJobResponse> {
    return this.http.get<PagedJobResponse>(`${this.apiUrl}/recent?page=${page}&size=${size}`);
  }

  /**
   * Download a generated file
   * This method triggers a true file download
   */
  public downloadFile(jobId: string): Observable<boolean> {
    return new Observable<boolean>(observer => {
      // Get the file with proper headers for direct download
      this.http.get(`${this.apiUrl}/download/${jobId}`, {
        responseType: 'blob',
        observe: 'response'
      }).subscribe({
        next: (response: HttpResponse<Blob>) => {
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
   */
  public cancelJob(jobId: string): Observable<{ cancelled: boolean }> {
    return this.http.post<{ cancelled: boolean }>(`${this.apiUrl}/cancel/${jobId}`, {});
  }

  /**
   * Retry a failed job
   */
  public retryJob(jobId: string): Observable<GenerateFileResponse> {
    return this.http.post<GenerateFileResponse>(`${this.apiUrl}/retry/${jobId}`, {});
  }
}
