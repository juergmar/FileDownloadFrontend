import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import {Observable, Subject, BehaviorSubject, map, catchError, interval, switchMap, tap} from 'rxjs';

import {
  FileType,
  JobDTO,
  GenerateFileRequest,
  GenerateFileResponse,
  WebSocketMessage,
  JobSubscriptionRequest
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
    return interval(intervalMs).pipe(
      switchMap(() => this.getJobStatus(jobId)),
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
      })
    );
  }

  public getJobStatus(jobId: string): Observable<JobDTO | null> {
    return this.http.get<JobDTO>(`${this.apiUrl}/status/${jobId}`).pipe(
      catchError(error => {
        console.error(`Error fetching status for job ${jobId}:`, error);
        // If the specific endpoint doesn't exist, fallback to get all jobs and filter
        return this.getRecentJobs().pipe(
          map(jobs => jobs.find(job => job.jobId === jobId) || null)
        );
      })
    );
  }

  /**
   * Subscribe to updates for a specific job
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
   * Get recent jobs
   */
  public getRecentJobs(page: number = 0, size: number = 10): Observable<JobDTO[]> {
    return this.http.get<JobDTO[]>(`${this.apiUrl}/recent?page=${page}&size=${size}`);
  }

  /**
   * Download a generated file
   * This method triggers a true file download
   */
  public downloadFile(jobId: string): Observable<boolean> {
    return new Observable<boolean>(observer => {
      // First, get the file information
      this.http.get(`${this.apiUrl}/info/${jobId}`).subscribe({
        next: (fileInfo: any) => {
          // Then download the file with proper headers
          this.http.get(`${this.apiUrl}/download/${jobId}`, {
            responseType: 'blob',
            observe: 'response'
          }).subscribe({
            next: (response: HttpResponse<Blob>) => {
              // Extract filename from Content-Disposition header or use a default
              let filename = 'report.csv';
              const contentDisposition = response.headers.get('Content-Disposition');
              if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                  filename = matches[1].replace(/['"]/g, '');
                }
              } else if (fileInfo && fileInfo.fileName) {
                filename = fileInfo.fileName;
              }

              // Create a blob url
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
        },
        error: (err) => {
          console.error('Error getting file info', err);

          // Fallback to direct download if file info fails
          this.downloadFileDirectly(jobId);
          observer.next(true);
          observer.complete();
        }
      });
    });
  }

  /**
   * Fallback method to download directly without info endpoint
   */
  private downloadFileDirectly(jobId: string): void {
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

        // Create a blob url
        const blob = response.body;
        if (!blob) {
          console.error('No file content received');
          return;
        }

        // Set content type if available
        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        const blobWithType = new Blob([blob], { type: contentType });

        // Create download link and trigger download
        this.saveFile(blobWithType, filename);
      },
      error: (err) => {
        console.error('Error downloading file directly', err);
      }
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
