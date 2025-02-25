import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const oauthService = inject(OAuthService);
  const router = inject(Router);

  // If the request is going to our API and we have a valid token
  if (req.url.includes('/api/') && oauthService.hasValidAccessToken()) {
    // Use the token from OAuthService directly
    const authToken = oauthService.getAccessToken();

    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${authToken}`)
    });

    // Handle 401 Unauthorized responses
    return next(authReq).pipe(
      catchError(error => {
        if (error.status === 401) {
          // If token refresh failed, redirect to login
          router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }

  // For non-API requests or without valid token, pass through
  return next(req);
};
