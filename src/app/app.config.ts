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
import { RxStompService } from './core/services/rx-stomp.service';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    providePrimeNG({ theme: { preset: Aura } }),
    {provide: AuthConfig, useValue: authConfig},
    {provide: MessageService, useClass: MessageService},
    {provide: 'RxStompService', useExisting: RxStompService},

    // Initialize OAuth and authentication in a single initializer
    provideAppInitializer(() => {
      const oauthService = inject(OAuthService);
      const authService = inject(AuthService);

      // Configure OAuth
      oauthService.configure(authConfig);

      // Initialize sequence: load discovery document -> try login -> setup auto refresh
      return oauthService.loadDiscoveryDocument()
        .then(() => oauthService.tryLogin())
        .then(() => {
          if (oauthService.hasValidAccessToken()) {
            oauthService.setupAutomaticSilentRefresh();
          }

          // Initialize auto-login system
          return authService.initializeAutoLogin();
        })
        .catch(error => {
          console.error('Error during authentication initialization:', error);
          return Promise.resolve(false);
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
