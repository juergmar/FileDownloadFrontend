import { ApplicationConfig, importProvidersFrom, inject, provideAppInitializer } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthConfig, OAuthModule, OAuthService } from 'angular-oauth2-oidc';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { authConfig } from './core/auth/auth-config';
import { MessageService } from 'primeng/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    providePrimeNG({ theme: { preset: Aura } }),
    {provide: AuthConfig, useValue: authConfig},
    {provide: MessageService, useClass: MessageService}, // Global message service

    // Ensure OAuth is initialized before the app starts
    provideAppInitializer(() => {
      const oauthService = inject(OAuthService);

      // Configure OAuth properly
      oauthService.configure(authConfig);

      // First, load the discovery document
      return oauthService.loadDiscoveryDocument()
        .then(() => {
          // Then try login with existing tokens
          return oauthService.tryLogin();
        })
        .then(() => {
          // Setup silent refresh if user is already logged in
          if (oauthService.hasValidAccessToken()) {
            oauthService.setupAutomaticSilentRefresh();
          }

          // Complete initialization
          return Promise.resolve();
        })
        .catch(error => {
          console.error('Error during OAuth initialization:', error);
          return Promise.resolve(); // Don't block app startup on errors
        });
    }),

    // Import OAuth module with configuration
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
