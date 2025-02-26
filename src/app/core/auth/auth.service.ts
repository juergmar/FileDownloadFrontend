import {Injectable} from '@angular/core';
import {AuthConfig, OAuthService} from 'angular-oauth2-oidc';
import {Router} from '@angular/router';

@Injectable({providedIn: 'root'})
export class AuthService {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly authConfig: AuthConfig,
    private readonly router: Router,
  ) {
    this.oauthService.setupAutomaticSilentRefresh();
  }

  public login(): Promise<void> {
    return this.tryLogin()
      .then(() => {
        if (!this.loggedIn()) {
          this.oauthService.initLoginFlow(window.location.pathname + window.location.search);
        }

        return Promise.resolve();
      })
      .then(() => {
        this.oauthService.state && this.router.navigateByUrl(decodeURIComponent(this.oauthService.state));
      });
  }

  public loggedIn(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  public logout(): void {
    return this.oauthService.logOut();
  }

  private async tryLogin(): Promise<boolean> {
    if (this.authConfig.loginUrl) {
      return this.oauthService.tryLogin();
    }

    await this.oauthService.loadDiscoveryDocument();
    return await this.oauthService.tryLogin();
  }
}
