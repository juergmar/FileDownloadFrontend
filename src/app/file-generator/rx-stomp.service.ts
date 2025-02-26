// rx-stomp.service.ts
import { Injectable, DestroyRef, inject } from '@angular/core';
import { RxStomp, RxStompState } from '@stomp/rx-stomp';
import { Observable, of, from, throwError } from 'rxjs';
import { tap, catchError, first, filter, timeout, map, takeUntil } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OAuthService } from 'angular-oauth2-oidc';
import { Csrf } from './csrf';
import { CsrfService } from './csrf.service';
import { environment } from '../auth/auth-config';

const DEFAULT_RECONNECT_DELAY = 5000;
const CONNECTION_TIMEOUT = 10000; // 10 seconds timeout for connection

@Injectable({
  providedIn: 'root'
})
export class RxStompService extends RxStomp {
  private destroyRef = inject(DestroyRef);
  private connectionPromise: Promise<boolean> | null = null;

  constructor(private oauthService: OAuthService, private csrfService: CsrfService) {
    super();
    this.initConnection();
  }

  /**
   * Initialize the connection
   */
  private initConnection(): void {
    this.init(this.csrfService, this.oauthService)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (connected) => {
          console.log(`WebSocket connection ${connected ? 'established' : 'failed'}`);
        },
        error: (err) => {
          console.error('WebSocket initialization error:', err);
        }
      });
  }

  /**
   * Initialize the STOMP connection with CSRF token
   */
  private init(csrfService: CsrfService, oauthService: OAuthService): Observable<boolean> {
    if (this.connectionPromise) {
      return from(this.connectionPromise);
    }

    this.connectionPromise = new Promise((resolve) => {
      csrfService.findCsrfToken()
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          tap((csrf: Csrf) => {
            this.connect(oauthService, csrf);

            // Monitor connection state
            this.connectionState$
              .pipe(
                takeUntilDestroyed(this.destroyRef),
                filter(state => state === RxStompState.OPEN),
                first(),
                timeout(CONNECTION_TIMEOUT)
              )
              .subscribe({
                next: () => resolve(true),
                error: () => resolve(false)
              });
          }),
          catchError(err => {
            console.error('Failed to get CSRF token:', err);
            resolve(false);
            return throwError(() => err);
          })
        )
        .subscribe();
    });

    return from(this.connectionPromise);
  }

  /**
   * Connect to the WebSocket broker
   */
  private connect(oauthService: OAuthService, csrf: Csrf): void {
    const reconnectDelay = environment.websocketReconnectDelay ?? DEFAULT_RECONNECT_DELAY;
    const token = oauthService.getAccessToken();

    if (!token) {
      console.error('No access token available for WebSocket connection');
      return;
    }

    // Include token in URL and prepare headers
    const brokerURL = `${environment.apiUrl.replace('http', 'ws')}/ws?token=${encodeURIComponent(token)}`;

    this.configure({
      brokerURL,
      reconnectDelay: +reconnectDelay,
      debug: (msg) => {
        if (environment.production) return;
        console.debug('[WebSocket]:', msg);
      },
      connectHeaders: {
        'X-XSRF-TOKEN': csrf.token,
        'Authorization': `Bearer ${token}` // Add token to connect headers as well
      },
      beforeConnect: (client) => {
        // Ensure the CSRF token and Authorization header are set for every connection attempt
        client.configure({
          connectHeaders: {
            'X-XSRF-TOKEN': csrf.token,
            'Authorization': `Bearer ${token}`
          }
        });
      },
      // Add heartbeat configuration to keep connection alive
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    console.log('Activating WebSocket connection...');
    this.activate();
  }

  /**
   * Check if the WebSocket is currently connected
   */
  public isConnected(): boolean {
    return this.connectionState$.getValue() === RxStompState.OPEN;
  }

  /**
   * Ensure WebSocket connection is established before proceeding
   * @returns Observable that resolves to true when connected
   */
  public ensureConnected(timeoutMs: number = 5000): Observable<boolean> {
    // If already connected, return true immediately
    if (this.isConnected()) {
      return of(true);
    }

    // Otherwise wait for connection
    return this.connectionState$.pipe(
      filter(state => state === RxStompState.OPEN),
      first(),
      timeout(timeoutMs),
      map(() => true),
      catchError(err => {
        console.error('WebSocket connection timeout:', err);
        return of(false);
      })
    );
  }

  /**
   * Manually reconnect the WebSocket - useful when auth token changes
   */
  public reconnect(): void {
    this.deactivate().then(() => {
      // Reset the connection promise to allow a fresh connection
      this.connectionPromise = null;
      this.initConnection();
    });
  }
}
