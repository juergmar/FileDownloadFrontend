import {ApplicationConfig, importProvidersFrom, inject, provideAppInitializer} from '@angular/core';
import {provideRouter, withHashLocation} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideAnimations} from '@angular/platform-browser/animations';
import {AuthConfig, OAuthModule, OAuthService} from 'angular-oauth2-oidc';
import Aura from '@primeng/themes/aura';

import {routes} from './app.routes';
import {providePrimeNG} from 'primeng/config';
import {authInterceptor} from './core/interceptors/auth.interceptor';
import {authConfig} from './core/auth/auth-config';


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    providePrimeNG({theme: {preset: Aura}}),
    {provide: AuthConfig, useValue: authConfig},
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
