import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';

import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {DividerModule} from 'primeng/divider';

import {AuthService} from '../auth/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    DividerModule
  ],
  template: `
    <div class="home-container">
      <div class="welcome-section">
        <h2>Welcome to the File Management System</h2>
        <p>Generate and download various reports with real-time updates on processing status.</p>

        <div class="actions">
          <p-button
            *ngIf="!authService.loggedIn()"
            label="Login"
            icon="pi pi-sign-in"
            routerLink="/login"
            styleClass="p-button-lg"
          ></p-button>

          <p-button
            *ngIf="authService.loggedIn()"
            label="Generate Reports"
            icon="pi pi-file"
            routerLink="/file-management"
            styleClass="p-button-lg"
          ></p-button>
        </div>
      </div>

      <p-divider></p-divider>

      <div class="features-section">
        <h3>Features</h3>
        <div class="feature-cards">
          <p-card header="Easy Report Generation" subheader="Multiple report types available">
            <p>Generate different types of reports based on your needs with our simple interface.</p>
          </p-card>

          <p-card header="Real-time Updates" subheader="Track progress instantly">
            <p>Get notified in real-time about your report generation status through WebSocket updates.</p>
          </p-card>

          <p-card header="Secure Access" subheader="Enterprise-grade security">
            <p>Access your reports securely with OpenID Connect authentication and authorization.</p>
          </p-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .welcome-section {
      text-align: center;
      padding: 2rem 0;

      h2 {
        font-size: 2rem;
        margin-bottom: 1rem;
        color: #343a40;
      }

      p {
        font-size: 1.1rem;
        color: #6c757d;
        margin-bottom: 2rem;
      }

      .actions {
        margin-top: 2rem;
      }
    }

    .features-section {
      padding: 2rem 0;

      h3 {
        text-align: center;
        margin-bottom: 2rem;
        font-size: 1.5rem;
        color: #343a40;
      }

      .feature-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
      }
    }

    @media (max-width: 768px) {
      .feature-cards {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class HomeComponent {
  constructor(public authService: AuthService) {
  }
}
