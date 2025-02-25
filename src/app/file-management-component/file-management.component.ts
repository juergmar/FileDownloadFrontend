// file-management.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {Tab, Tabs, TabsModule} from 'primeng/tabs'; // Import TabsModule
import { CardModule } from 'primeng/card';
import { FileGeneratorComponent } from '../file-generator/file-generator.component';

@Component({
  selector: 'app-file-management',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    CardModule,
    FileGeneratorComponent,
  ],
  template: `
    <div class="file-management-container">
      <p-card>
        <h2>File Management</h2>
        <p-tabs value="0">
          <p-tablist>
            <p-tab value="0">Generate File</p-tab>
            <p-tab value="1">My Files</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="0">
              <app-file-generator></app-file-generator>
            </p-tabpanel>
            <p-tabpanel value="1">
              <div class="my-files-container">
                <p>View and manage your previously generated files.</p>
              </div>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      </p-card>
    </div>

  `,
  styles: [`
    .file-management-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }
    .my-files-container {
      padding: 1rem 0;
    }
  `]
})
export class FileManagementComponent {}
