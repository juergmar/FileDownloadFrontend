import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {environment} from '../auth/auth-config';
import {Csrf} from '../models/csrf';

@Injectable({
  providedIn: 'root',
})
export class CsrfService {
  private path: string = `${environment.apiUrl}/csrf`;

  constructor(private readonly httpClient: HttpClient) {
  }

  public findCsrfToken(): Observable<Csrf> {
    return this.httpClient.get<Csrf>(this.path);
  }
}
