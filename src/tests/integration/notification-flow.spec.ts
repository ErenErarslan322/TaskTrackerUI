import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it, vi } from 'vitest';
import { AuthService } from '../../app/features/auth/auth.service';
import { NotificationEvent } from '../../app/features/notifications/notification.model';
import { ChatMessage } from '../../app/core/realtime/chat-message.model';
import { SignalrService } from '../../app/core/realtime/signalr.service';
import { TopbarComponent } from '../../app/layout/topbar.component';
import { mockHub } from '../support/hub-double';

it('loads missed notifications, removes viewed entries, and expires chat messages after 12 hours', () => {
  vi.useFakeTimers();
  const now = Date.now();
  const lifetime = 12 * 60 * 60 * 1000;
  const message: ChatMessage = {
    sender: 'Deniz',
    receiver: 'eren',
    text: 'Merhaba',
    timestamp: '14:00',
    createdAt: now,
    isRead: false
  };
  const otherRecipient = { ...message, sender: 'İpek', receiver: 'elif' };
  const expired = { ...message, sender: 'Eski', createdAt: now - lifetime };
  localStorage.setItem('chatMessages', JSON.stringify([message, otherRecipient, expired]));
  localStorage.setItem('taskTracker_notifications_eren', JSON.stringify([
    { kind: 'message', sender: 'Deniz', id: 'legacy', receivedAt: Date.now(), read: false }
  ]));

  const hub = mockHub({ deferStart: true });

  try {
    TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: signal('eren'), isLoggedIn: signal(true) } }
      ]
    });
    const fixture = TestBed.createComponent(TopbarComponent);
    const root: HTMLElement = fixture.nativeElement;
    const signalr = TestBed.inject(SignalrService);
    const http = TestBed.inject(HttpTestingController);
    const apiUrl = 'http://localhost:5032/api/notifications';
    fixture.detectChanges();
    const bell = root.querySelector<HTMLButtonElement>('.notification-bell')!;
    const dot = () => root.querySelector('.notification-dot');

    expect(bell.getAttribute('aria-label')).toBe('Bildirimler, 1 okunmamış');
    expect(dot()).not.toBeNull();

    const assignment: NotificationEvent = {
      id: 'assignment',
      kind: 'task-assignment',
      sender: 'Deniz',
      subject: 'Rapor',
      receivedAt: now
    };
    signalr.startConnection('eren');
    http.expectOne({ method: 'GET', url: apiUrl }).flush([assignment]);
    hub.emit('ReceiveNotification', assignment);
    fixture.detectChanges();
    expect(bell.getAttribute('aria-label')).toBe('Bildirimler, 2 okunmamış');

    bell.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.notification-list li')).toHaveLength(2);
    expect(root.querySelector('.notification-list')?.textContent).toContain('“Rapor” görevini atadı');
    expect(dot()).toBeNull();
    expect(signalr.totalUnreadCount()).toBe(1);
    expect(JSON.parse(localStorage.getItem('chatMessages')!)[0].notificationRead).toBe(true);
    const dismissed = http.expectOne({ method: 'POST', url: `${apiUrl}/dismiss` });
    expect(dismissed.request.body).toEqual(['assignment']);
    dismissed.flush(null);
    hub.emit('ReceiveNotification', assignment);
    bell.click();
    bell.click();
    fixture.detectChanges();
    expect(root.querySelector('.notification-list')?.textContent).toContain('Henüz bildirim yok.');

    bell.click();
    hub.emit('ReceiveMessage', { ...message, text: 'Yeni mesaj' });
    fixture.detectChanges();
    expect(root.querySelector('.notification-bell-icon.ringing')).not.toBeNull();
    expect(dot()).not.toBeNull();
    expect(signalr.totalUnreadCount()).toBe(2);
    vi.advanceTimersByTime(lifetime - 1);
    expect(signalr.totalUnreadCount()).toBe(2);
    vi.advanceTimersByTime(1);
    expect(signalr.messages()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('chatMessages')!)).toEqual([]);

    const events: { event: NotificationEvent; text: string }[] = [
      { event: { id: 'invitation', kind: 'team-invitation', sender: 'Deniz', subject: 'Platform', receivedAt: Date.now() }, text: 'Platform takımına ekledi' },
      { event: { id: 'removal', kind: 'team-removal', sender: 'Deniz', subject: 'Platform', receivedAt: Date.now() }, text: 'Platform takımından çıkardı' }
    ];
    for (const { event, text } of events) {
      const previousBell = root.querySelector('.notification-bell-icon');
      hub.emit('ReceiveNotification', event);
      fixture.detectChanges();
      const ringingBell = root.querySelector('.notification-bell-icon.ringing');
      expect(ringingBell).not.toBeNull();
      expect(ringingBell).not.toBe(previousBell);
      expect(dot()).not.toBeNull();
      bell.click();
      fixture.detectChanges();
      expect(root.querySelector('.notification-list')?.textContent).toContain(text);
      const dismiss = http.expectOne({ method: 'POST', url: `${apiUrl}/dismiss` });
      expect(dismiss.request.body).toEqual([event.id]);
      dismiss.flush(null);
      bell.click();
    }

    const sharedMessage = { ...message, id: 'shared-message', createdAt: Date.now(), notificationRead: false };
    localStorage.setItem('chatMessages', JSON.stringify([sharedMessage]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'chatMessages' }));
    fixture.detectChanges();
    expect(signalr.totalUnreadCount()).toBe(1);
    expect(dot()).not.toBeNull();
    const ringingBell = root.querySelector('.notification-bell-icon.ringing');
    expect(ringingBell).not.toBeNull();

    hub.emit('ReceiveMessage', sharedMessage);
    fixture.detectChanges();
    expect(root.querySelector('.notification-bell-icon.ringing')).toBe(ringingBell);
    signalr.markAsRead('Deniz');
    fixture.detectChanges();
    expect(signalr.totalUnreadCount()).toBe(0);
    expect(dot()).not.toBeNull();

    bell.click();
    fixture.detectChanges();
    expect(root.querySelector('.notification-list')?.textContent).toContain('Deniz sana mesaj gönderdi.');
    expect(dot()).toBeNull();
    http.verify();
  } finally {
    hub.restore();
    localStorage.removeItem('chatMessages');
    localStorage.removeItem('taskTracker_notifications_eren');
    localStorage.removeItem('taskTracker_notifications_eren_pendingDismissals');
    vi.useRealTimers();
  }
});
