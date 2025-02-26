import {inject} from '@angular/core';
import {HttpHandlerFn, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {OAuthService} from 'angular-oauth2-oidc';
import {catchError, throwError} from 'rxjs';
import {Router} from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const oauthService = inject(OAuthService);
  const router = inject(Router);

  if (req.url.includes('/api/') && oauthService.hasValidAccessToken()) {
    const authToken = oauthService.getAccessToken();

    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${authToken}`)
    });

    return next(authReq).pipe(
      catchError(error => {
        if (error.status === 401) {
          router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};
