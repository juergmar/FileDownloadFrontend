import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {CheckboxModule} from 'primeng/checkbox';
import {CardModule} from 'primeng/card';
import {ReportFormBaseComponent} from './report-form-base.component';
import {FileType} from '../../models/file-generation.models';
import {SystemHealthReportRequest} from '../../models/report-request.models';

@Component({
  selector: 'app-system-health-report-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    CardModule
  ],
  template: `
    <div class="p-fluid">
      <div class="p-field mb-3">
        <div class="p-field-checkbox">
          <p-checkbox
            [(ngModel)]="includeDetailedMetrics"
            [binary]="true"
            inputId="includeDetailedMetrics"
            [disabled]="isGenerating"
          ></p-checkbox>
          <label for="includeDetailedMetrics" class="ml-2">Include detailed metrics</label>
        </div>
        <small class="form-helper-text">
          Including detailed metrics will increase the report size but provide more comprehensive information.
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
          [disabled]="isGenerating"
          (onClick)="submitForm()"
        ></p-button>
      </div>
    </div>
  `,
  styles: [`
    .p-field {
      margin-bottom: 1.25rem;
    }

    .p-field-checkbox {
      display: flex;
      align-items: center;
    }

    .form-helper-text {
      display: block;
      margin-top: 0.25rem;
      color: #6c757d;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
    }

    .mr-2 {
      margin-right: 0.5rem;
    }

    .ml-2 {
      margin-left: 0.5rem;
    }

    .mt-4 {
      margin-top: 1.5rem;
    }
  `]
})
export class SystemHealthReportFormComponent extends ReportFormBaseComponent {
  public includeDetailedMetrics: boolean = false;

  public getReportType(): FileType {
    return FileType.SYSTEM_HEALTH_REPORT;
  }

  public isValid(): boolean {
    return true;
  }

  public getReportRequest(): SystemHealthReportRequest {
    return {
      type: FileType.SYSTEM_HEALTH_REPORT,
      includeDetailedMetrics: this.includeDetailedMetrics
    };
  }
}
