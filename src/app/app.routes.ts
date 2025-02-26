import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { authGuard } from './core/guards/auth.guard';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';

// This callback function handles OAuth redirect after login
// It retrieves stored redirect URL and navigates there
export function oauthCallbackHandler(): Promise<boolean> {
  const oauthService = inject(OAuthService);

  return new Promise<boolean>((resolve) => {
    // Process the OAuth callback
    oauthService.tryLogin().then(() => {
      // Try to get redirect URL from local storage
      const redirectUrl = localStorage.getItem('authRedirectUrl') || '/';
      localStorage.removeItem('authRedirectUrl');

      // Navigate to the redirect URL
      window.location.href = redirectUrl;
      resolve(true);
    }).catch(() => {
      // If login fails, go to home
      window.location.href = '/';
      resolve(false);
    });
  });
}

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'file-management',
    loadChildren: () =>
      import('./features/file-management/file-management.routes').then(m => m.FILE_MANAGEMENT_ROUTES),
    canActivate: [authGuard]
  },
  {
    // OAuth callback route
    path: 'callback',
    component: HomeComponent,
    resolve: { callback: () => oauthCallbackHandler() }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
