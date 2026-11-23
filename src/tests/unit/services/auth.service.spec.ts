import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../app/features/auth/auth.service';

const authUrl = 'http://localhost:5032/api/auth';
const credentials = { username: 'test-user', password: 'test-password' };

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    http.verify();
  });

  it('restores a stored session and clears its keys on logout', () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('username', credentials.username);
    localStorage.setItem('userId', '7');
    localStorage.setItem('unrelated', 'keep');
    const service = TestBed.inject(AuthService);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()).toBe(credentials.username);

    service.logout();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.hasToken()).toBe(false);
    expect(service.currentUser()).toBe('');
    expect(localStorage.getItem('userId')).toBeNull();
    expect(localStorage.getItem('username')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it.each([
    { token: 'test-token', username: ' test-user ', userId: 7 },
    { Token: 'test-token', Username: ' test-user ', Id: 7 }
  ])('stores successful login data from supported API response shapes', response => {
    const service = TestBed.inject(AuthService);
    service.login(credentials).subscribe();
    const login = http.expectOne({ method: 'POST', url: `${authUrl}/login` });
    expect(login.request.body).toEqual(credentials);
    expect(service.isLoggedIn()).toBe(false);
    login.flush(response);

    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()).toBe(credentials.username);
    expect(localStorage.getItem('token')).toBe('test-token');
    expect(localStorage.getItem('userId')).toBe('7');
  });

  it('leaves session state unchanged when credentials are rejected', () => {
    const service = TestBed.inject(AuthService);
    const onError = vi.fn();
    service.login(credentials).subscribe({ error: onError });
    http.expectOne(`${authUrl}/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(onError).toHaveBeenCalledOnce();
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('registers an account without starting a session', () => {
    const service = TestBed.inject(AuthService);
    const registration = { ...credentials, email: 'test-user@example.test' };
    service.register(registration).subscribe();
    const request = http.expectOne({ method: 'POST', url: `${authUrl}/register` });
    expect(request.request.body).toEqual(registration);
    request.flush({ message: 'OK' });
    expect(service.isLoggedIn()).toBe(false);
  });
});
