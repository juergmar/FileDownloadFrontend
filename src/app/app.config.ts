// app.config.ts
import {ApplicationConfig, importProvidersFrom, inject, provideAppInitializer} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { OAuthModule, OAuthService } from 'angular-oauth2-oidc';
import Aura from '@primeng/themes/aura';
import { AuthConfig } from 'angular-oauth2-oidc';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { providePrimeNG } from 'primeng/config';
import {authConfig} from './auth/auth-config';


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    providePrimeNG({ theme: { preset: Aura } }),
    { provide: AuthConfig, useValue: authConfig },
    provideAppInitializer(() =>
      inject(OAuthService).loadDiscoveryDocumentAndTryLogin()
    ),
    importProvidersFrom(
      OAuthModule.forRoot({
        resourceServer: {
          allowedUrls: ['http://localhost:8080/api'],
          sendAccessToken: true
        }
      })
    )
  ]
};
