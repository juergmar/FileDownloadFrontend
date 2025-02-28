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
import { AutoLoginService } from './core/auth/auto-login.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    providePrimeNG({ theme: { preset: Aura } }),
    {provide: AuthConfig, useValue: authConfig},
    {provide: MessageService, useClass: MessageService}, // Global message service
    {provide: 'RxStompService', useExisting: RxStompService}, // Important: Provide as string token for lazy lookup

    provideAppInitializer(async () => {
      const oauthService = inject(OAuthService);

      oauthService.configure(authConfig);

      try {
        await oauthService.loadDiscoveryDocument();
        await oauthService.tryLogin();
        if (oauthService.hasValidAccessToken()) {
          oauthService.setupAutomaticSilentRefresh();
        }
        return await Promise.resolve();
      } catch (error) {
        console.error('Error during OAuth initialization:', error);
        return await Promise.resolve();
      }
    }),

    provideAppInitializer(() => {
      const autoLoginService = inject(AutoLoginService);
      return autoLoginService.initializeAutoLogin();
    }),

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
