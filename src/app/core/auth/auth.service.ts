import {inject, Injectable, Injector} from '@angular/core';
import {AuthConfig, OAuthEvent, OAuthService} from 'angular-oauth2-oidc';
import {NavigationEnd, Router} from '@angular/router';
import {BehaviorSubject, fromEvent, Observable} from 'rxjs';
import {filter} from 'rxjs/operators';
import {MessageService} from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oauthService: OAuthService = inject(OAuthService);
  private readonly authConfig: AuthConfig = inject(AuthConfig);
  private readonly router: Router = inject(Router);
  private readonly messageService: MessageService = inject(MessageService);
  private readonly injector: Injector = inject(Injector);

  private readonly isLoggedInSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public readonly isLoggedIn$: Observable<boolean> = this.isLoggedInSubject.asObservable();

  private tokenExpirationTimer: any;
  private readonly TOKEN_MIN_VALIDITY = 60; // 60 seconds
  private rxStompService: any; // Will be initialized lazily to avoid circular dependency

  /**
   * Constructor
   */
  public constructor() {
    this.setupTokenManagement();
    this.setupEventListeners();
    this.checkLoginStatus();
    this.setupRouteListener();
  }

  /**
   * Initialize the auto-login service
   * This should be called from APP_INITIALIZER
   */
  public initializeAutoLogin(): Promise<boolean> {
    // Initial authentication check
    return this.checkAuthentication();
  }

  /**
   * Initiates the login flow
   * @returns Promise<void>
   */
  public login(): Promise<void> {
    // Store current URL for redirection after login
    localStorage.setItem('authRedirectUrl', window.location.href);

    return this.tryLogin()
      .then(() => {
        if (!this.loggedIn()) {
          this.oauthService.initLoginFlow();
        }
        return Promise.resolve();
      });
  }

  /**
   * Checks if the user is currently logged in
   * @returns boolean
   */
  public loggedIn(): boolean {
    const isLoggedIn = this.oauthService.hasValidAccessToken();

    if (this.isLoggedInSubject.getValue() !== isLoggedIn) {
      this.isLoggedInSubject.next(isLoggedIn);

      // If we've just logged in, setup token refresh
      if (isLoggedIn) {
        this.startTokenExpirationTimer();
      }
    }

    return isLoggedIn;
  }

  /**
   * Logs the user out and redirects to home
   * @returns void
   */
  public logout(): void {
    this.clearTokenExpirationTimer();
    this.oauthService.logOut();
    this.isLoggedInSubject.next(false);
    this.router.navigate(['/']);

    // Auto-login after logout
    setTimeout(() => this.login(), 500);
  }

  /**
   * Gets the user's access token
   * @returns string or null if not available
   */
  public getAccessToken(): string | null {
    return this.oauthService.getAccessToken();
  }

  /**
   * Gets user info from the token
   * @returns any
   */
  public getUserInfo(): any {
    const claims = this.oauthService.getIdentityClaims();
    if (claims) {
      return claims;
    }
    return null;
  }

  /**
   * Gets username from token claims
   * @returns string
   */
  public getUsername(): string {
    const claims = this.getUserInfo();
    return claims ? (claims.preferred_username || claims.name || 'User') : 'User';
  }

  /**
   * Attempts to refresh the tokens
   * @returns Promise<boolean>
   */
  public refreshTokens(): Promise<boolean> {
    console.log('Attempting to refresh tokens');
    return new Promise<boolean>((resolve) => {
      this.oauthService.refreshToken()
        .then(() => {
          console.log('Token refresh successful');
          // Reconnect WebSocket with new token - using lazy injection
          if (!this.rxStompService) {
            // Lazy load RxStompService to avoid circular dependency
            this.rxStompService = this.injector.get('RxStompService');
          }

          if (this.rxStompService) {
            this.rxStompService.reconnect();
          }

          // Reset the timer after a successful refresh
          this.startTokenExpirationTimer();
          resolve(true);
        })
        .catch((error) => {
          console.error('Token refresh failed:', error);
          this.messageService.add({
            severity: 'warn',
            summary: 'Session Expiring',
            detail: 'Your session is about to expire. Please log in again.'
          });
          resolve(false);
        });
    });
  }

  /**
   * Check if the user is authenticated and redirect to login if not
   * Skip this check for the callback route
   */
  private checkAuthentication(): Promise<boolean> {
    // Skip login check for callback route
    if (window.location.href.includes('/callback')) {
      return Promise.resolve(true);
    }

    if (!this.loggedIn()) {
      console.log('User not authenticated, redirecting to login...');

      // Wait a moment to ensure route has settled
      setTimeout(() => this.login(), 100);

      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  /**
   * Setup route change listener to check authentication
   */
  private setupRouteListener(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkAuthentication();
    });
  }

  /**
   * Configures token management
   * @returns void
   */
  private setupTokenManagement(): void {
    this.oauthService.setupAutomaticSilentRefresh();

    // Configure token refresh parameters
    const refreshConfig = {
      timeoutFactor: 0.75,
      disableSilentRefresh: false,
      silentRefreshTimeout: 5000
    };

    this.oauthService.configure({
      ...this.authConfig,
      ...refreshConfig
    });
  }

  /**
   * Sets up event listeners
   * @returns void
   */
  private setupEventListeners(): void {
    // Listen for visibility changes to check token when tab becomes visible
    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible')
      )
      .subscribe(() => {
        this.checkAndRefreshToken();
      });

    // Listen for OAuth service events
    this.oauthService.events
      .pipe(
        filter((event: OAuthEvent) =>
          event.type === 'token_received' ||
          event.type === 'token_refreshed' ||
          event.type === 'token_expires' ||
          event.type === 'logout'
        )
      )
      .subscribe((event: OAuthEvent) => {
        // Update login status when token-related events occur
        this.isLoggedInSubject.next(this.oauthService.hasValidAccessToken());

        // Update token timer on certain events
        if (event.type === 'token_received' || event.type === 'token_refreshed') {
          this.startTokenExpirationTimer();
        } else if (event.type === 'logout') {
          this.clearTokenExpirationTimer();
        }
      });
  }

  /**
   * Starts the token expiration timer
   * @returns void
   */
  private startTokenExpirationTimer(): void {
    this.clearTokenExpirationTimer();

    // Calculate when the token will expire
    const expiresAt = this.oauthService.getAccessTokenExpiration();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Calculate when we should try to refresh the token
    const refreshTime = Math.min(
      timeUntilExpiry - (this.TOKEN_MIN_VALIDITY * 1000),
      timeUntilExpiry / 2
    );

    if (refreshTime > 0) {
      console.log(`Token will be refreshed in ${Math.round(refreshTime / 1000)} seconds`);
      this.tokenExpirationTimer = setTimeout(() => {
        this.refreshTokens();
      }, refreshTime);
    } else {
      // Token is already close to expiry, try to refresh immediately
      this.refreshTokens();
    }
  }

  /**
   * Clears the token expiration timer
   * @returns void
   */
  private clearTokenExpirationTimer(): void {
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  /**
   * Check and refresh token if needed
   * @returns void
   */
  private checkAndRefreshToken(): void {
    if (this.loggedIn()) {
      const expiresAt = this.oauthService.getAccessTokenExpiration();
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // If token is close to expiry, refresh it
      if (timeUntilExpiry <= (this.TOKEN_MIN_VALIDITY * 1000)) {
        this.refreshTokens();
      }
    }
  }

  /**
   * Check login status when service initializes
   * @returns void
   */
  private checkLoginStatus(): void {
    this.isLoggedInSubject.next(this.loggedIn());
  }

  /**
   * Try to login with existing tokens
   * @returns Promise<boolean>
   */
  private async tryLogin(): Promise<boolean> {
    if (this.authConfig.loginUrl) {
      return this.oauthService.tryLogin();
    }

    await this.oauthService.loadDiscoveryDocument();
    return await this.oauthService.tryLogin();
  }
}
