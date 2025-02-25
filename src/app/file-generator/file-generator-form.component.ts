import {Component, EventEmitter, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

// PrimeNG Imports
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {DropdownModule} from 'primeng/dropdown';
import {DialogModule} from 'primeng/dialog';
import {FileType} from './file-generation.models';

@Component({
  selector: 'app-file-generator-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    DialogModule
  ],
  templateUrl: './file-generator-form.component.html',
  styleUrls: ['./file-generator-form.component.scss']
})
export class FileGeneratorFormComponent {
  @Output() public generateFile = new EventEmitter<{
    fileType: FileType;
    parameters?: Record<string, any>;
  }>();

  public fileTypes: Array<{ label: string; value: FileType }> = [
    { label: 'User Activity Report', value: FileType.USER_ACTIVITY_REPORT },
    { label: 'System Health Report', value: FileType.SYSTEM_HEALTH_REPORT },
    { label: 'File Statistics Report', value: FileType.FILE_STATISTICS_REPORT },
    { label: 'Custom Report', value: FileType.CUSTOM_REPORT }
  ];

  public selectedFileType: FileType = FileType.USER_ACTIVITY_REPORT;
  public showParametersDialog: boolean = false;
  public parameters: Record<string, any> = {};
  public isGenerating: boolean = false;

  // Used for custom report parameters
  public customReportName: string = '';

  public openParametersDialog(): void {
    this.parameters = {};

    if (this.selectedFileType === FileType.USER_ACTIVITY_REPORT) {
      this.parameters['startDate'] = '30'; // Default 30 days
    } else if (this.selectedFileType === FileType.CUSTOM_REPORT) {
      this.customReportName = '';
    }

    this.showParametersDialog = true;
  }

  public closeParametersDialog(): void {
    this.showParametersDialog = false;
  }

  public submitGenerateFile(): void {
    // Prepare parameters based on the file type
    if (this.selectedFileType === FileType.CUSTOM_REPORT && this.customReportName) {
      this.parameters['reportName'] = this.customReportName;
    }

    this.isGenerating = true;
    this.showParametersDialog = false;

    this.generateFile.emit({
      fileType: this.selectedFileType,
      parameters: this.parameters
    });

    // Reset generating state after a small delay
    setTimeout(() => {
      this.isGenerating = false;
    }, 1000);
  }
}
