import {Component, EventEmitter, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {DropdownModule} from 'primeng/dropdown';
import {DialogModule} from 'primeng/dialog';
import {SelectButton} from 'primeng/selectbutton';
import {ReportRequest} from '../../models/report-request.models';
import {FileType} from '../../models/file-generation.models';
import {UserActivityReportFormComponent} from '../report-forms/user-activity-report-form.component';
import {SystemHealthReportFormComponent} from '../report-forms/system-health-report-form.component';
import {FileStatisticsReportFormComponent} from '../report-forms/file-statistics-report-form.component';
import {CustomReportFormComponent} from '../report-forms/custom-report-form.component';

interface ReportTypeOption {
  label: string;
  value: FileType;
  description: string;
}

@Component({
  selector: 'app-file-generator-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    DialogModule,
    UserActivityReportFormComponent,
    SystemHealthReportFormComponent,
    FileStatisticsReportFormComponent,
    CustomReportFormComponent,
    SelectButton
  ],
  templateUrl: './file-generator-form.component.html',
  styleUrls: ['./file-generator-form.component.scss']
})
export class FileGeneratorFormComponent {
  public FileType = FileType;

  public fileTypes: ReportTypeOption[] = [
    {
      label: 'User Activity',
      value: FileType.USER_ACTIVITY_REPORT,
      description: 'Generate a report of user activities over a specified time period.'
    },
    {
      label: 'System Health',
      value: FileType.SYSTEM_HEALTH_REPORT,
      description: 'Monitor system performance and health metrics.'
    },
    {
      label: 'File Statistics',
      value: FileType.FILE_STATISTICS_REPORT,
      description: 'Analyze file usage and storage statistics.'
    },
    {
      label: 'Custom Report',
      value: FileType.CUSTOM_REPORT,
      description: 'Create a customized report with specific parameters.'
    }
  ];

  public selectedFileType: FileType = FileType.USER_ACTIVITY_REPORT;
  public showParametersDialog: boolean = false;
  public isGenerating: boolean = false;

  @Output() public generateFile = new EventEmitter<ReportRequest>();

  /**
   * Open the parameters dialog for the selected report type
   */
  public openParametersDialog(): void {
    if (!this.selectedFileType) {
      return;
    }
    this.showParametersDialog = true;
  }

  /**
   * Close the parameters dialog
   */
  public closeParametersDialog(): void {
    this.showParametersDialog = false;
  }

  /**
   * Handle generate event from child form components
   * @param request The report request
   */
  public onGenerate(request: ReportRequest): void {
    this.isGenerating = true;
    this.showParametersDialog = false;

    this.generateFile.emit(request);

    setTimeout(() => {
      this.isGenerating = false;
    }, 1000);
  }

  /**
   * Get the dialog header based on the selected file type
   */
  public getDialogHeader(): string {
    const option = this.fileTypes.find(t => t.value === this.selectedFileType);
    return option ? `Configure ${option.label} Report` : 'Configure Report';
  }

  /**
   * Get the description for the selected report type
   */
  public getSelectedTypeDescription(): string {
    const option = this.fileTypes.find(t => t.value === this.selectedFileType);
    return option ? option.description : '';
  }
}
