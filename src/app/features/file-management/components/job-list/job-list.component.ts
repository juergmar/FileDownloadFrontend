import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';

import {TableModule} from 'primeng/table';
import {TagModule} from 'primeng/tag';
import {ButtonModule} from 'primeng/button';
import {TooltipModule} from 'primeng/tooltip';
import {CardModule} from 'primeng/card';
import {SkeletonModule} from 'primeng/skeleton';
import {PaginatorModule} from 'primeng/paginator';
import {FileTypePipe} from '../../pipes/file-type.pipe';
import {JobStatusPipe} from '../../pipes/job-status.pipe';
import {JobDTO, JobStatus} from '../../models/file-generation.models';

@Component({
  selector: 'app-job-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    CardModule,
    SkeletonModule,
    PaginatorModule,
    FileTypePipe,
    JobStatusPipe
  ],
  templateUrl: './job-list.component.html',
  styleUrls: ['./job-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobListComponent {
  @Input() public jobs: JobDTO[] = [];
  @Input() public loading: boolean = false;
  @Input() public currentPage: number = 0;
  @Input() public pageSize: number = 10;
  @Input() public totalItems: number = 0;
  @Input() public totalPages: number = 0;

  @Output() public download = new EventEmitter<string>();
  @Output() public cancel = new EventEmitter<string>();
  @Output() public retry = new EventEmitter<string>();
  @Output() public refresh = new EventEmitter<void>();
  @Output() public pageChange = new EventEmitter<any>();

  public getStatusSeverity(status: JobStatus): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status) {
      case JobStatus.COMPLETED:
        return 'success';
      case JobStatus.FAILED:
        return 'danger';
      case JobStatus.CANCELLED:
        return 'warn';
      case JobStatus.IN_PROGRESS:
      case JobStatus.PENDING:
        return 'info';
      default:
        return 'secondary';
    }
  }

  public isJobInProgress(job: JobDTO): boolean {
    return job.status === JobStatus.PENDING || job.status === JobStatus.IN_PROGRESS;
  }

  public onDownloadClicked(jobId: string): void {
    this.download.emit(jobId);
  }

  public onCancelClicked(jobId: string): void {
    this.cancel.emit(jobId);
  }

  public onRetryClicked(jobId: string): void {
    this.retry.emit(jobId);
  }

  public onRefreshClicked(): void {
    this.refresh.emit();
  }

  public onPageChangeEvent(event: any): void {
    this.pageChange.emit(event);
  }

  public trackByJobId(index: number, job: JobDTO): string {
    return job.jobId;
  }
}
