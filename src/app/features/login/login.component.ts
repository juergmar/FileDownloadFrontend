import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';

import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {AuthService} from '../auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule
  ],
  template: `
    <div class="login-container">
      <p-card header="Login" styleClass="login-card">
        <div class="flex flex-column align-items-center">
          <p>Please log in to access the file management system.</p>
          <p-button
            label="Login with SSO"
            icon="pi pi-sign-in"
            (onClick)="login()"
            styleClass="mt-3"
          ></p-button>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 80vh;
      background-color: #f8f9fa;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      text-align: center;
    }

    .mt-3 {
      margin-top: 1rem;
    }
  `]
})
export class LoginComponent implements OnInit {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    if (this.authService.loggedIn()) {
      const redirectUrl = sessionStorage.getItem('redirectUrl') || '/';
      sessionStorage.removeItem('redirectUrl');
      this.router.navigateByUrl(redirectUrl);
    }
  }

  login(): void {
    this.authService.login();
  }
}
