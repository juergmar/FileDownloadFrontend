import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Service to handle automatic login across the application
 */
@Injectable({
  providedIn: 'root'
})
export class AutoLoginService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * Initialize the auto-login service
   * This should be called from APP_INITIALIZER
   */
  public initializeAutoLogin(): Promise<boolean> {
    // Monitor route changes to check authentication
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkAuthentication();
    });

    // Initial authentication check
    return this.checkAuthentication();
  }

  /**
   * Check if the user is authenticated and redirect to login if not
   * Skip this check for the callback route
   */
  private checkAuthentication(): Promise<boolean> {
    // Skip login check for callback route
    if (window.location.href.includes('/callback')) {
      return Promise.resolve(true);
    }

    if (!this.authService.loggedIn()) {
      console.log('User not authenticated, redirecting to login...');
      // Store current URL for redirection after login
      localStorage.setItem('authRedirectUrl', window.location.href);

      // Wait a moment to ensure route has settled
      setTimeout(() => {
        this.authService.login();
      }, 100);

      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }
}
