import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ReportRequest } from '../../models/report-request.models';
import { FileType } from '../../models/file-generation.models';
import {ReportFormComponent} from '../report-form/report-form.component';

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
    DialogModule,
    SelectButtonModule,
    ReportFormComponent
  ],
  templateUrl: './file-generator-form.component.html',
  styleUrls: ['./file-generator-form.component.scss']
})
export class FileGeneratorFormComponent {
  @Output() public generateFile = new EventEmitter<ReportRequest>();

  public FileType = FileType;
  public selectedFileType: FileType = FileType.USER_ACTIVITY_REPORT;
  public showParametersDialog: boolean = false;
  public isGenerating: boolean = false;

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
   * Handle generate event from child form component
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
