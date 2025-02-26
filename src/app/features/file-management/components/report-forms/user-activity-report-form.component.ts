import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {InputNumberModule} from 'primeng/inputnumber';
import {CardModule} from 'primeng/card';
import {ReportFormBaseComponent} from './report-form-base.component';
import {FileType} from '../../models/file-generation.models';
import {UserActivityReportRequest} from '../../models/report-request.models';

@Component({
  selector: 'app-user-activity-report-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    CardModule,
  ],
  template: `
    <div class="p-fluid">
      <div class="p-field mb-3">
        <label for="startDate" class="form-label">Time Span (days)</label>
        <p-inputNumber
          id="startDate"
          [(ngModel)]="startDate"
          [min]="1"
          [max]="365"
          [showButtons]="true"
          [disabled]="isGenerating"
          class="w-full"
        ></p-inputNumber>
        <small *ngIf="startDate < 1 || startDate > 365" class="p-error">
          Time span must be between 1 and 365 days
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
  `]
})
export class UserActivityReportFormComponent extends ReportFormBaseComponent {
  public startDate: number = 30;

  public getReportType(): FileType {
    return FileType.USER_ACTIVITY_REPORT;
  }

  public isValid(): boolean {
    return this.startDate >= 1 && this.startDate <= 365;
  }

  public getReportRequest(): UserActivityReportRequest {
    return {
      type: FileType.USER_ACTIVITY_REPORT,
      startDate: this.startDate
    };
  }
}
