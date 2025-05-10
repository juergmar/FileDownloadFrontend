import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {CheckboxModule} from 'primeng/checkbox';
import {InputTextModule} from 'primeng/inputtext';
import {InputNumberModule} from 'primeng/inputnumber';
import {CardModule} from 'primeng/card';
import {FileType} from '../../models/file-generation.models';
import {ReportRequest} from '../../models/report-request.models';
import {Subject} from 'rxjs';

interface FormField {
  type: 'text' | 'number' | 'checkbox';
  name: string;
  label: string;
  defaultValue: any;
  validators?: any[];
  helperText?: string;
  min?: number;
  max?: number;
}

@Component({
  selector: 'app-report-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    InputNumberModule,
    CardModule
  ],
  templateUrl: './report-form.component.html',
  styleUrls: ['./report-form.component.scss']
})
export class ReportFormComponent implements OnInit, OnDestroy {
  @Input() public reportType!: FileType;
  @Input() public title: string = 'Report Configuration';
  @Input()
  public set isGenerating(value: boolean) {
    this._isGenerating = value;
    this.updateFormState();
  }
  public get isGenerating(): boolean {
    return this._isGenerating;
  }

  @Output() public generate = new EventEmitter<ReportRequest>();
  @Output() public cancel = new EventEmitter<void>();

  public form!: FormGroup;
  public fields: FormField[] = [];
  private _isGenerating: boolean = false;
  private destroy$ = new Subject<void>();

  public constructor(private fb: FormBuilder) {}

  public ngOnInit(): void {
    this.initFormFields();
    this.buildForm();
    this.updateFormState();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initFormFields(): void {
    switch (this.reportType) {
      case FileType.USER_ACTIVITY_REPORT:
        this.fields = [
          {
            type: 'number',
            name: 'startDate',
            label: 'Time Span (days)',
            defaultValue: 30,
            validators: [Validators.required, Validators.min(1), Validators.max(365)],
            min: 1,
            max: 365
          }
        ];
        break;
      case FileType.SYSTEM_HEALTH_REPORT:
        this.fields = [
          {
            type: 'checkbox',
            name: 'includeDetailedMetrics',
            label: 'Include detailed metrics',
            defaultValue: false,
            helperText: 'Including detailed metrics will increase the report size but provide more comprehensive information.'
          }
        ];
        break;
      case FileType.FILE_STATISTICS_REPORT:
        this.fields = [
          {
            type: 'checkbox',
            name: 'includeHistoricalData',
            label: 'Include historical data',
            defaultValue: false,
            helperText: 'Including historical data will add trend analysis to the report covering the past 12 months.'
          }
        ];
        break;
      case FileType.CUSTOM_REPORT:
        this.fields = [
          {
            type: 'text',
            name: 'reportName',
            label: 'Report Name',
            defaultValue: '',
            validators: [Validators.required]
          }
        ];
        break;
    }
  }

  private buildForm(): void {
    const formGroup: any = {};

    this.fields.forEach(field => {
      formGroup[field.name] = [field.defaultValue, field.validators || []];
    });

    this.form = this.fb.group(formGroup);
  }

  public submitForm(): void {
    if (this.form.valid) {
      const request: ReportRequest = {
        type: this.reportType,
        ...this.form.value
      };
      this.generate.emit(request);
    }
  }

  public cancelForm(): void {
    this.cancel.emit();
  }

  public isValid(): boolean {
    return this.form?.valid || false;
  }

  private updateFormState(): void {
    if (!this.form) return;

    if (this._isGenerating) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }
}
