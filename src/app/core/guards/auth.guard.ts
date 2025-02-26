import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, of, map, catchError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Guard to protect routes that require authentication
 * Will attempt token refresh if token is invalid
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If user is already logged in with a valid token, allow access immediately
  if (authService.loggedIn()) {
    return true;
  }

  // Try to refresh token if user has an expired token
  return attemptTokenRefresh(authService, router, state.url);
};

/**
 * Attempts to refresh token and returns an observable boolean result
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
          // Store the return URL and redirect to login
          localStorage.setItem('authRedirectUrl', returnUrl);
          authService.login();
          observer.next(false);
          observer.complete();
        }
      })
      .catch(() => {
        // Login error, redirect to login
        localStorage.setItem('authRedirectUrl', returnUrl);
        authService.login();
        observer.next(false);
        observer.complete();
      });
  });
}
