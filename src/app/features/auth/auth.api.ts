import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../../core/api-endpoints';
import { Credentials, Registration } from './auth.model';

export interface LoginResponse {
  username?: string;
  Username?: string;
  token?: string;
  Token?: string;
  userId?: number;
  UserId?: number;
  id?: number;
  Id?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/auth`;

  login(credentials: Credentials) {
    return this.http.post<LoginResponse>(`${this.url}/login`, credentials);
  }

  register(registration: Registration) {
    return this.http.post<unknown>(`${this.url}/register`, registration);
  }
}
