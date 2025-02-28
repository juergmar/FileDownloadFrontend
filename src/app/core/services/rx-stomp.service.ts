import { DestroyRef, inject, Injectable, Injector } from '@angular/core';
import { RxStomp, RxStompState } from '@stomp/rx-stomp';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, filter, first, map, tap, timeout } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OAuthService } from 'angular-oauth2-oidc';
import { CsrfService } from './csrf.service';
import { environment } from '../auth/auth-config';
import { Csrf } from '../models/csrf';

const DEFAULT_RECONNECT_DELAY = 5000;
const CONNECTION_TIMEOUT = 10000;

/**
 * Service for WebSocket communication using RxStomp
 */
@Injectable({
  providedIn: 'root'
})
export class RxStompService extends RxStomp {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private connectionPromise: Promise<boolean> | null = null;

  /**
   * Constructor
   */
  public constructor() {
    super();
    // Using setTimeout to avoid immediate circular dependency
    setTimeout(() => this.initConnection(), 0);
  }

  /**
   * Check if the WebSocket is currently connected
   * @returns True if connected
   */
  public isConnected(): boolean {
    return this.connectionState$.getValue() === RxStompState.OPEN;
  }

  /**
   * Ensure WebSocket connection is established before proceeding
   * @param timeoutMs Timeout in milliseconds
   * @returns Observable that resolves to true when connected
   */
  public ensureConnected(timeoutMs: number = 5000): Observable<boolean> {
    if (this.isConnected()) {
      return of(true);
    }

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
      this.connectionPromise = null;
      this.initConnection();
    });
  }

  /**
   * Initialize the connection
   */
  private initConnection(): void {
    // Get services from injector to avoid circular dependency
    const csrfService = this.injector.get(CsrfService);
    const oauthService = this.injector.get(OAuthService);

    this.init(csrfService, oauthService)
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
   * @param csrfService CSRF service
   * @param oauthService OAuth service
   * @returns Observable boolean indicating if connection was successful
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
   * @param oauthService OAuth service
   * @param csrf CSRF token
   */
  private connect(oauthService: OAuthService, csrf: Csrf): void {
    const reconnectDelay = environment.websocketReconnectDelay ?? DEFAULT_RECONNECT_DELAY;
    const token = oauthService.getAccessToken();

    if (!token) {
      console.error('No access token available for WebSocket connection');
      return;
    }

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
        'Authorization': `Bearer ${token}`
      },
      beforeConnect: (client) => {
        client.configure({
          connectHeaders: {
            'X-XSRF-TOKEN': csrf.token,
            'Authorization': `Bearer ${token}`
          }
        });
      },
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    console.log('Activating WebSocket connection...');
    this.activate();
  }
}
