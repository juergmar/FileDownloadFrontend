import { inject } from '@angular/core';
import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Only add auth headers to API requests
  if (req.url.includes('/api/')) {
    if (authService.loggedIn()) {
      const authToken = authService.getAccessToken();

      if (!authToken) {
        return next(req).pipe(
          catchError((error) => handleAuthError(error, router, authService))
        );
      }

      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${authToken}`)
      });

      return next(authReq).pipe(
        catchError((error) => {
          // Handle 401/403 errors (token expired or invalid)
          if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
            return handleUnauthorized(req, next, error, authService, router);
          }
          return throwError(() => error);
        })
      );
    } else {
      // Not logged in, try to handle gracefully
      return next(req).pipe(
        catchError((error) => handleAuthError(error, router, authService))
      );
    }
  }

  // Pass through non-API requests without auth header
  return next(req);
};

/**
 * Handle unauthorized errors by refreshing token and retrying
 */
function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  error: HttpErrorResponse,
  authService: AuthService,
  router: Router
) {
  return throwError(() => error).pipe(
    switchMap(() => {
      return new Promise<boolean>((resolve) => {
        authService.refreshTokens()
          .then((refreshed) => resolve(refreshed))
          .catch(() => resolve(false));
      });
    }),
    switchMap((refreshed) => {
      if (refreshed && authService.loggedIn()) {
        const newToken = authService.getAccessToken();
        const authReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${newToken}`)
        });
        return next(authReq);
      } else {
        router.navigate(['/']);
        authService.login();
        return throwError(() => error);
      }
    })
  );
}

/**
 * Handle general auth errors
 */
function handleAuthError(error: any, router: Router, authService: AuthService) {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401 || error.status === 403) {
      console.error('Authentication error', error);
      router.navigate(['/']);
      authService.login();
    }
  }
  return throwError(() => error);
}
