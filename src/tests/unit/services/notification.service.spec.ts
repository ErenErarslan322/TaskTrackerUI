import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../app/features/auth/auth.service';
import { NotificationService } from '../../../app/features/notifications/notification.service';
import { notification, session } from '../../support/fixtures';

const apiUrl = 'http://localhost:5032/api/notifications';
const cacheKey = 'taskTracker_notifications_test-user';
const retryKey = `${cacheKey}_pendingDismissals`;

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;
  let auth: ReturnType<typeof session>;

  beforeEach(() => {
    localStorage.clear();
    auth = session();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }]
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    http.verify();
  });

  it('adds an inbox item once when it arrives through the API and SignalR', () => {
    const item = notification();
    service.load();
    service.receive(item);
    const firstRing = service.ringingId();
    http.expectOne(apiUrl).flush([item]);
    expect(service.notifications()).toEqual([item]);
    expect(service.ringingId()).toBe(firstRing);

    service.receive(notification({ id: 'second', kind: 'team-removal' }));
    expect(service.notifications()).toHaveLength(2);
    expect(service.ringingId()).toBeGreaterThan(firstRing);
  });

  it('hides a dismissed item immediately and retries after an HTTP failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const item = notification();
    service.receive(item);
    service.dismiss([item]);
    expect(service.notifications()).toEqual([]);
    const firstDismiss = http.expectOne({ method: 'POST', url: `${apiUrl}/dismiss` });
    expect(firstDismiss.request.body).toEqual([item.id]);
    firstDismiss.error(new ProgressEvent('error'));
    expect(JSON.parse(localStorage.getItem(retryKey)!)).toEqual([item.id]);

    service.load();
    const retry = http.expectOne({ method: 'POST', url: `${apiUrl}/dismiss` });
    expect(retry.request.body).toEqual([item.id]);
    http.expectOne(apiUrl).flush([item]);
    expect(service.notifications()).toEqual([]);
    retry.flush(null);
    expect(localStorage.getItem(retryKey)).toBeNull();
  });

  it('restores unread legacy entries while removing viewed items and duplicate chat copies', () => {
    const legacy = notification({ id: 'legacy-invitation', kind: 'team-invitation' });
    localStorage.setItem(cacheKey, JSON.stringify([
      { ...legacy, read: false },
      { ...legacy, id: 'viewed', read: true },
      { ...legacy, id: 'old-chat', kind: 'message', read: false }
    ]));
    expect(service.notifications().map(item => item.id)).toEqual([legacy.id]);
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toHaveLength(1);

    service.dismiss(service.notifications());
    expect(service.notifications()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual([]);
    http.expectNone(`${apiUrl}/dismiss`);
  });

  it('ignores a previous account response and stops fetching after logout', () => {
    service.load();
    const previous = http.expectOne(apiUrl);
    auth.currentUser.set('other-test-user');
    previous.flush([notification()]);
    expect(service.notifications()).toEqual([]);
    expect(service.ringingId()).toBe(0);

    auth.isLoggedIn.set(false);
    service.load();
    service.receive(notification());
    expect(service.notifications()).toEqual([]);
    http.expectNone(apiUrl);
  });
});
