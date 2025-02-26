import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  FileType,
  GenerateFileRequest,
  GenerateFileResponse,
  PagedJobResponse
} from './file-generation.models';
import { environment } from '../auth/auth-config';

/**
 * Service responsible for handling all API requests related to file generation
 */
@Injectable({
  providedIn: 'root'
})
export class FileGeneratorApiService {
  private readonly apiUrl: string = `${environment.apiUrl}/files`;

  public constructor(private readonly httpClient: HttpClient) {}

  /**
   * Generate a new file
   * @param fileType The type of file to generate
   * @param parameters Optional parameters for file generation
   * @returns Observable with the job details
   */
  public generateFile(fileType: FileType, parameters?: Record<string, any>): Observable<GenerateFileResponse> {
    const request: GenerateFileRequest = {
      fileType,
      parameters
    };
    return this.httpClient.post<GenerateFileResponse>(`${this.apiUrl}/generate`, request);
  }

  /**
   * Get recent jobs with pagination
   * @param page Page number (0-based)
   * @param size Page size
   * @returns Observable with paginated jobs
   */
  public getRecentJobs(page: number = 0, size: number = 10): Observable<PagedJobResponse> {
    return this.httpClient.get<PagedJobResponse>(`${this.apiUrl}/recent?page=${page}&size=${size}`);
  }

  /**
   * Download a generated file
   * @param jobId ID of the job
   * @returns Observable with the file blob response
   */
  public downloadFile(jobId: string): Observable<HttpResponse<Blob>> {
    return this.httpClient.get(`${this.apiUrl}/download/${jobId}`, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  /**
   * Cancel a job
   * @param jobId ID of the job to cancel
   * @returns Observable indicating if cancellation was successful
   */
  public cancelJob(jobId: string): Observable<{ cancelled: boolean }> {
    return this.httpClient.post<{ cancelled: boolean }>(`${this.apiUrl}/cancel/${jobId}`, {});
  }

  /**
   * Retry a failed job
   * @param jobId ID of the job to retry
   * @returns Observable with the new job details
   */
  public retryJob(jobId: string): Observable<GenerateFileResponse> {
    return this.httpClient.post<GenerateFileResponse>(`${this.apiUrl}/retry/${jobId}`, {});
  }
}
