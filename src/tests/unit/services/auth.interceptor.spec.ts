import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authInterceptor } from '../../../app/features/auth/auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('token');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem('token');
    http.verify();
  });

  it('adds the current Bearer token while preserving the request body and custom headers', () => {
    localStorage.setItem('token', 'current-session');
    const payload = { name: 'Test takımı' };
    client.post('/api/teams', payload, { headers: { 'X-Test': 'preserve' } }).subscribe();
    const request = http.expectOne({ method: 'POST', url: '/api/teams' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer current-session');
    expect(request.request.headers.get('X-Test')).toBe('preserve');
    expect(request.request.body).toEqual(payload);
    request.flush({});
  });

  it('sends requests without an authorization header after logout', () => {
    client.get('/api/tasks').subscribe();
    const request = http.expectOne('/api/tasks');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });
});
