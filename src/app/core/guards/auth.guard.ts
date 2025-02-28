import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, of, map, catchError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Guard to protect routes that require authentication
 * Will initiate login flow if token is invalid
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If user is already logged in with a valid token, allow access immediately
  if (authService.loggedIn()) {
    return true;
  }

  // Store the return URL and redirect to login
  localStorage.setItem('authRedirectUrl', state.url);

  // Try to refresh token if user has an expired token
  return attemptTokenRefresh(authService, router, state.url);
};

/**
 * Attempts to refresh token and returns an observable boolean result
 * Automatically initiates login flow if refresh fails
 */
function attemptTokenRefresh(
  authService: AuthService,
  router: Router,
  returnUrl: string
): Observable<boolean> {
  return new Observable<boolean>(observer => {
    authService.refreshTokens()
      .then(refreshed => {
        if (refreshed && authService.loggedIn()) {
          observer.next(true);
          observer.complete();
        } else {
          // Login error, initiate login flow
          localStorage.setItem('authRedirectUrl', returnUrl);
          authService.login();
          observer.next(false);
          observer.complete();
        }
      })
      .catch(() => {
        // Login error, initiate login flow
        localStorage.setItem('authRedirectUrl', returnUrl);
        authService.login();
        observer.next(false);
        observer.complete();
      });
  });
}
