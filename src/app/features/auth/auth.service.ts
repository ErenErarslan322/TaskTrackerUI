import { Injectable, inject, signal } from '@angular/core';
import { Credentials, Registration } from './auth.model';
import { AuthApi } from './auth.api';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly api = inject(AuthApi);

  isLoggedIn = signal<boolean>(this.hasToken());
  currentUser = signal<string>(localStorage.getItem('username') || '');

  login(user: Credentials) {
    return this.api.login(user).pipe(
      tap(res => {
        const loggedUsername = (res.username || res.Username || user.username || '').trim();
        const loggedUserId = res.userId || res.UserId || res.id || res.Id || 1;

        localStorage.setItem('token', String(res.token || res.Token));
        localStorage.setItem('username', loggedUsername);
        localStorage.setItem('userId', String(loggedUserId));

        this.isLoggedIn.set(true);
        this.currentUser.set(loggedUsername);
      })
    );
  }

  register(user: Registration) {
    return this.api.register(user);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    
    this.isLoggedIn.set(false);
    this.currentUser.set('');
  }

  hasToken(): boolean {
    return !!localStorage.getItem('token');
  }
}
