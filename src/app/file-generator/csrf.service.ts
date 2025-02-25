// csrf.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Csrf } from './csrf';
import { HttpClient } from '@angular/common/http';
import {environment} from '../auth/auth-config';

@Injectable({
  providedIn: 'root',
})
export class CsrfService {
  // Ensure this points to your backend API endpoint.
  private path: string = `${environment.apiUrl}/csrf`;

  constructor(private readonly httpClient: HttpClient) {}

  public findCsrfToken(): Observable<Csrf> {
    return this.httpClient.get<Csrf>(this.path);
  }
}
