// file: file-generator.component.ts
import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {catchError, finalize, of, Subject, Subscription, takeWhile, timer} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

// PrimeNG & Components
import {CardModule} from 'primeng/card';
import {ToastModule} from 'primeng/toast';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {ConfirmationService, MessageService} from 'primeng/api';
import {ProcessingDialogComponent} from './processing-dialog/processing-dialog.component';
import {FileGeneratorFormComponent} from './file-generator-form.component';
import {JobListComponent} from './job-list.component';

// Services & Models
import {FileGenerationService} from './file-generation.service';
import {FileType, JobDTO, JobStatus, WebSocketMessage} from './file-generation.models';

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
    private destroy$ = new Subject<void>();

    public recentJobs: JobDTO[] = [];
    public loading = false;
    public connectionStatus = false;
    public currentProcessingJob: JobDTO | null = null;
    public showProcessingDialog = false;

    private readonly WEBSOCKET_TIMEOUT_MS: number = 30000; // 30 seconds

    private readonly POLLING_INTERVAL_MS: number = 3000; // Poll every 3 seconds
    private pollingSubscription?: Subscription;

    ngOnInit(): void {
        this.loadRecentJobs();
        this.subscribeToGlobalJobUpdates();
        this.fileGenerationService.connectionStatus$
            .pipe(takeUntil(this.destroy$))
            .subscribe(connected => {
                this.connectionStatus = connected;

                // Alert user if WebSocket connection is lost
                if (!connected && this.showProcessingDialog) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Connection Issue',
                        detail: 'Real-time updates may be delayed. The status will refresh when you reload the page.'
                    });
                }
            });
    }

    ngOnDestroy(): void {
        this.stopPolling(); // Make sure to stop polling
        this.destroy$.next();
        this.destroy$.complete();
    }

    onGenerateFile({ fileType, parameters }: { fileType: FileType; parameters?: Record<string, any> }): void {
        this.fileGenerationService.generateFile(fileType, parameters)
            .pipe(
                takeUntil(this.destroy$),
                catchError(err => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: err.error?.message || 'Failed to start file generation'
                    });
                    return of(null); // Return an observable that completes
                })
            )
            .subscribe(response => {
                if (!response) return; // Skip if error occurred

                // Set up current processing job and open dialog
                this.currentProcessingJob = {
                    jobId: response.jobId,
                    fileType,
                    status: JobStatus.PENDING,
                    createdAt: new Date().toISOString(),
                    fileDataAvailable: false
                };
                this.showProcessingDialog = true;

                // Subscribe for job updates via WebSocket
                this.fileGenerationService.subscribeToJobUpdates(response.jobId);

                // Start polling for job status (dual mechanism)
                this.startPolling(response.jobId);
            });
    }

    private setupWebSocketTimeout(jobId: string): void {
        let updatesReceived = false;

        const subscription = this.fileGenerationService.jobStatusUpdates$
            .pipe(takeUntil(this.destroy$))
            .subscribe(message => {
                if (message.jobId === jobId) {
                    updatesReceived = true;
                }
            });

        // After timeout period, check if updates were received
        timer(this.WEBSOCKET_TIMEOUT_MS)
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => subscription.unsubscribe())
            )
            .subscribe(() => {
                if (!updatesReceived && this.showProcessingDialog &&
                    this.currentProcessingJob?.jobId === jobId) {
                    console.log(`No WebSocket updates received for job ${jobId}. Forcing status refresh.`);

                    // Force refresh job status
                    this.loadRecentJobs();

                    // Close dialog if it's still showing the same job
                    if (this.currentProcessingJob?.jobId === jobId) {
                        this.showProcessingDialog = false;

                        this.messageService.add({
                            severity: 'info',
                            summary: 'Status Update',
                            detail: 'Real-time updates not received. Please check job status in the list below.'
                        });
                    }
                }
            });
    }

    private startPolling(jobId: string): void {
        // Stop any existing polling
        this.stopPolling();

        console.log(`Starting to poll for job ${jobId} status every ${this.POLLING_INTERVAL_MS}ms`);

        this.pollingSubscription = this.fileGenerationService.pollJobStatus(jobId, this.POLLING_INTERVAL_MS)
            .pipe(
                // Continue polling until job reaches a terminal state or component is destroyed
                takeWhile(job => job !== null &&
                        ![JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status),
                    true), // Include the last value that fails the predicate
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

                    if ([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status)) {
                        // Terminal state reached, update UI
                        this.updateJobInList(job);

                        // If this job is in the dialog, prepare to close it
                        if (this.currentProcessingJob?.jobId === jobId) {
                            console.log(`Job ${jobId} reached terminal state ${job.status} (via polling). Closing dialog in 3s.`);

                            timer(3000)
                                .pipe(takeUntil(this.destroy$))
                                .subscribe(() => {
                                    console.log(`Closing dialog for completed job ${jobId}`);
                                    this.showProcessingDialog = false;
                                });
                        }

                        // No need to continue polling
                        this.stopPolling();
                    }
                }
            });
    }

    /**
     * Stop any active polling
     */
    private stopPolling(): void {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
            this.pollingSubscription = undefined;
        }
    }

    private updateJobInList(job: JobDTO): void {
        const index = this.recentJobs.findIndex(j => j.jobId === job.jobId);
        if (index > -1) {
            this.recentJobs[index] = { ...this.recentJobs[index], ...job };
        } else {
            // If job isn't in the list, add it
            this.recentJobs = [job, ...this.recentJobs];
        }
    }

    onDownloadFile(jobId: string): void {
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
                error: err => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Download Failed',
                        detail: 'Failed to download the file: ' + (err.message || 'Unknown error')
                    });
                }
            });
    }

    onCancelJob(jobId: string): void {
        this.confirmationService.confirm({
            message: 'Are you sure you want to cancel this job?',
            accept: () => {
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
                        },
                        error: err => {
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Error',
                                detail: err.error?.message || 'Failed to cancel the job'
                            });
                        }
                    });
            }
        });
    }

    onRetryJob(jobId: string): void {
        this.fileGenerationService.retryJob(jobId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: response => {
                    const job = this.recentJobs.find(j => j.jobId === jobId);
                    if (job) {
                        this.currentProcessingJob = {
                            jobId: response.jobId,
                            fileType: job.fileType,
                            status: JobStatus.PENDING,
                            createdAt: new Date().toISOString(),
                            fileDataAvailable: false
                        };
                        this.showProcessingDialog = true;
                        this.fileGenerationService.subscribeToJobUpdates(response.jobId);
                        this.messageService.add({
                            severity: 'info',
                            summary: 'Job Retried',
                            detail: `New Job ID: ${response.jobId}`
                        });
                    }
                },
                error: err => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: err.error?.message || 'Failed to retry the job'
                    });
                }
            });
    }

    onJobsRefresh(): void {
        this.loadRecentJobs();
    }

    private loadRecentJobs(): void {
        this.loading = true;
        this.fileGenerationService.getRecentJobs()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: jobs => {
                    this.recentJobs = jobs;
                    this.loading = false;
                },
                error: err => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Failed to load recent jobs: ' + err.message
                    });
                    this.loading = false;
                }
            });
    }

    private subscribeToGlobalJobUpdates(): void {
        this.fileGenerationService.jobStatusUpdates$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: WebSocketMessage) => {
                this.updateJobStatus(message.jobId, message.status, message);
                if (this.currentProcessingJob && this.currentProcessingJob.jobId === message.jobId) {
                    this.currentProcessingJob = {...this.currentProcessingJob, ...message};
                    if ([JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(message.status)) {
                        timer(3000).pipe(takeUntil(this.destroy$)).subscribe(() => {
                            this.showProcessingDialog = false;
                        });
                    }
                }
            });
    }

    private updateJobStatus(jobId: string, status: JobStatus, update?: Partial<JobDTO>): void {
        const index = this.recentJobs.findIndex(j => j.jobId === jobId);
        if (index > -1) {
            this.recentJobs[index] = {...this.recentJobs[index], status, ...update};
        }
    }

    public downloadCurrentProcessingFile(): void {
        if (this.currentProcessingJob) {
            this.onDownloadFile(this.currentProcessingJob.jobId);
        }
    }
}
