import { Directive, EventEmitter, Input, Output } from '@angular/core';
import { ReportRequest } from './report-request.models';
import { FileType } from './file-generation.models';

/**
 * Base component for all report form components
 */
@Directive()
export abstract class ReportFormBaseComponent {
  @Input() public isGenerating: boolean = false;
  @Output() public generate = new EventEmitter<ReportRequest>();
  @Output() public cancel = new EventEmitter<void>();

  /**
   * Get the report type
   */
  public abstract getReportType(): FileType;

  /**
   * Validate the form and return true if valid
   */
  public abstract isValid(): boolean;

  /**
   * Get the report request
   */
  public abstract getReportRequest(): ReportRequest;

  /**
   * Submit the form
   */
  public submitForm(): void {
    if (this.isValid()) {
      this.generate.emit(this.getReportRequest());
    }
  }

  /**
   * Cancel form submission
   */
  public cancelForm(): void {
    this.cancel.emit();
  }
}
