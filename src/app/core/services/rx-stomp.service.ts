// rx-stomp.service.ts
import {DestroyRef, inject, Injectable} from '@angular/core';
import {RxStomp, RxStompState} from '@stomp/rx-stomp';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {catchError, filter, first, map, timeout} from 'rxjs/operators';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {OAuthService} from 'angular-oauth2-oidc';
import {MessageService} from 'primeng/api';
import {getWebSocketUrl, rxStompConfig} from './rx-stomp.config';

const MAX_RECONNECT_ATTEMPTS = 3;

@Injectable({
  providedIn: 'root'
})
export class RxStompService extends RxStomp {
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly oauthService: OAuthService = inject(OAuthService);
  private readonly messageService: MessageService = inject(MessageService);

  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private reconnectAttempts = 0;
  private reconnecting = false;

  // Expose the connection status as an observable
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor() {
    super();

    // Initialize the connection
    this.setupConnection();

    // Subscribe to the token refresh event from OAuth service if available
    if (this.oauthService['eventsSubject']) {
      this.oauthService['eventsSubject']
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(event => {
          if (event.type === 'token_received' || event.type === 'token_refreshed') {
            console.log('Token refreshed, reconnecting WebSocket...');
            this.reconnect();
          }
        });
    }

    // Monitor connection state changes
    this.connectionState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        const isConnected = state === RxStompState.OPEN;
        this.connectionStatusSubject.next(isConnected);

        if (isConnected) {
          console.log('WebSocket connection established');
          this.reconnectAttempts = 0;
        } else if (state === RxStompState.CLOSED && !this.reconnecting) {
          console.warn('WebSocket connection closed');
          this.handleDisconnection();
        }
      });
  }

  /**
   * Setup the initial connection
   */
  private setupConnection(): void {
    const token = this.oauthService.getAccessToken();

    if (!token) {
      console.error('No access token available for WebSocket connection');
      return;
    }

    // Get the complete WebSocket URL with token
    const brokerURL = getWebSocketUrl(token);
    console.log(`Connecting to WebSocket at: ${brokerURL}`);

    try {
      this.configure({
        ...rxStompConfig,
        brokerURL
      });

      this.activate();
    } catch (error) {
      console.error('Error setting up WebSocket connection:', error);
    }
  }

  /**
   * Check if the WebSocket is currently connected
   */
  public isConnected(): boolean {
    return this.connectionState$.getValue() === RxStompState.OPEN;
  }

  /**
   * Ensure WebSocket connection is established before proceeding
   */
  public ensureConnected(timeoutMs: number = 5000): Observable<boolean> {
    if (this.isConnected()) {
      return of(true);
    }

    // If not connected, attempt to reconnect
    if (this.connectionState$.getValue() === RxStompState.CLOSED) {
      this.reconnect();
    }

    return this.connectionState$.pipe(
      filter(state => state === RxStompState.OPEN),
      first(),
      timeout(timeoutMs),
      map(() => true),
      catchError(err => {
        console.warn('WebSocket connection could not be established within timeout period');
        return of(false);
      })
    );
  }

  /**
   * Handle a disconnection event
   */
  private handleDisconnection(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
      this.messageService.add({
        severity: 'error',
        summary: 'Connection Error',
        detail: 'Could not establish real-time connection. Please refresh the page.'
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * this.reconnectAttempts, 5000);

    console.log(`Attempting reconnect ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

    setTimeout(() => {
      if (!this.isConnected()) {
        this.reconnect();
      }
    }, delay);
  }

  /**
   * Manually reconnect the WebSocket
   */
  public reconnect(): void {
    if (this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    console.log('Reconnecting WebSocket...');

    this.deactivate().then(() => {
      const token = this.oauthService.getAccessToken();

      if (!token) {
        console.error('No access token available for WebSocket reconnection');
        this.reconnecting = false;
        return;
      }

      const brokerURL = getWebSocketUrl(token);
      console.log(`Reconnecting to WebSocket at: ${brokerURL}`);

      try {
        this.configure({
          ...rxStompConfig,
          brokerURL
        });

        this.activate();
      } catch (error) {
        console.error('Error during WebSocket reconnection:', error);
      } finally {
        this.reconnecting = false;
      }
    }).catch(error => {
      console.error('Error deactivating WebSocket:', error);
      this.reconnecting = false;
    });
  }
}
