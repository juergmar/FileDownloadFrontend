import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { FileGeneratorComponent } from '../file-generator/file-generator.component';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-file-management',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    CardModule,
    ButtonModule,
    FileGeneratorComponent,
  ],
  providers: [
    MessageService
  ],
  templateUrl: './file-management.component.html',
  styleUrls: ['./file-management.component.scss']
})
export class FileManagementComponent {
  /**
   * The currently active tab value
   */
  public activeTabValue: string = '0';

  /**
   * Switch to the Generate File tab
   * @returns {void}
   */
  public activateGenerateTab(): void {
    this.activeTabValue = '0';
  }
}
