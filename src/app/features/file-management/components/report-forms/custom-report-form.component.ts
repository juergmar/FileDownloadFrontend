import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {CardModule} from 'primeng/card';
import {ReportFormBaseComponent} from './report-form-base.component';
import {FileType} from '../../models/file-generation.models';
import {CustomReportRequest} from '../../models/report-request.models';

@Component({
  selector: 'app-custom-report-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    CardModule
  ],
  template: `
    <div class="p-fluid">
      <div class="p-field mb-3">
        <label for="reportName" class="form-label">Report Name</label>
        <input
          id="reportName"
          type="text"
          pInputText
          [(ngModel)]="reportName"
          [disabled]="isGenerating"
          class="w-full"
        />
        <small *ngIf="reportName.trim() === ''" class="p-error">
          Report name is required
        </small>
      </div>

      <div class="form-actions mt-4">
        <p-button
          label="Cancel"
          icon="pi pi-times"
          styleClass="p-button-text"
          [disabled]="isGenerating"
          (onClick)="cancelForm()"
          class="mr-2"
        ></p-button>
        <p-button
          label="Generate Report"
          icon="pi pi-check"
          [disabled]="!isValid() || isGenerating"
          (onClick)="submitForm()"
        ></p-button>
      </div>
    </div>
  `,
  styles: [`
    .p-field {
      margin-bottom: 1.25rem;
    }

    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
    }

    .mr-2 {
      margin-right: 0.5rem;
    }

    .mt-4 {
      margin-top: 1.5rem;
    }

    .w-full {
      width: 100%;
    }
  `]
})
export class CustomReportFormComponent extends ReportFormBaseComponent {
  public reportName: string = '';

  public getReportType(): FileType {
    return FileType.CUSTOM_REPORT;
  }

  public isValid(): boolean {
    return this.reportName.trim() !== '';
  }

  public getReportRequest(): CustomReportRequest {
    return {
      type: FileType.CUSTOM_REPORT,
      reportName: this.reportName.trim()
    };
  }
}
