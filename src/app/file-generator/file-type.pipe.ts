import { Pipe, PipeTransform } from '@angular/core';
import {FileType} from './file-generation.models';

@Pipe({
  name: 'fileType',
  standalone: true
})
export class FileTypePipe implements PipeTransform {
  private fileTypeLabels: Record<FileType, string> = {
    [FileType.USER_ACTIVITY_REPORT]: 'User Activity Report',
    [FileType.SYSTEM_HEALTH_REPORT]: 'System Health Report',
    [FileType.FILE_STATISTICS_REPORT]: 'File Statistics Report',
    [FileType.CUSTOM_REPORT]: 'Custom Report'
  };

  public transform(value: FileType | undefined): string {
    if (!value) {
      return 'Unknown Report Type';
    }

    return this.fileTypeLabels[value] || value.split('_').join(' ').toLowerCase();
  }
}
