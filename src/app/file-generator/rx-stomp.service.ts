import {Injectable} from '@angular/core';
import {RxStomp} from '@stomp/rx-stomp';
import {Observable, tap} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {OAuthService} from 'angular-oauth2-oidc';
import {Csrf} from './csrf';
import {CsrfService} from './csrf.service';
import {environment} from '../auth/auth-config';

const DEFAULT_RECONNECT_DELAY = 5000;

@Injectable({
  providedIn: 'root'
})
export class RxStompService extends RxStomp {

  constructor(oauthService: OAuthService, csrfService: CsrfService) {
    super();
    this.init(csrfService, oauthService).subscribe();
  }

  private init(csrfService: CsrfService, oauthService: OAuthService): Observable<Csrf> {
    return csrfService.findCsrfToken().pipe(
      takeUntilDestroyed(),
      tap((csrf: Csrf) => this.connect(oauthService, csrf))
    );
  }

  private connect(oauthService: OAuthService, csrf: Csrf): void {
    const reconnectDelay = environment.websocketReconnectDelay ?? DEFAULT_RECONNECT_DELAY;
    const brokerURL = environment.apiUrl.replace('http', 'ws') + '/ws';
    this.configure({
      brokerURL,
      reconnectDelay: +reconnectDelay,
      beforeConnect: (client) => {
        client.configure({
          connectHeaders: {
            'Authorization': `Bearer ${oauthService.getAccessToken()}`,
            'X-XSRF-TOKEN': csrf.token
          }
        });
      }
    });
    this.activate();
  }
}


