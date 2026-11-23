import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it, vi } from 'vitest';
import { SidebarComponent } from '../../../../app/layout/sidebar.component';
import { SignalrService } from '../../../../app/core/realtime/signalr.service';

it('renders one logo, displays unread chats and emits logout', () => {
  const totalUnreadCount = signal(0);
  TestBed.configureTestingModule({
    imports: [SidebarComponent],
    providers: [provideRouter([]), { provide: SignalrService, useValue: { totalUnreadCount } }]
  });
  const fixture = TestBed.createComponent(SidebarComponent);
  const root = fixture.nativeElement as HTMLElement;
  const logout = vi.fn();
  fixture.componentInstance.logoutClick.subscribe(logout);
  fixture.detectChanges();
  expect(root.querySelectorAll('.logo-container .logo-icon')).toHaveLength(1);
  expect(root.querySelector('.logo-icon')?.getAttribute('aria-hidden')).toBe('true');
  expect(root.querySelector('a[href="/messages"]')).not.toBeNull();
  expect(root.querySelector('.unread-badge')).toBeNull();

  totalUnreadCount.set(2);
  fixture.detectChanges();
  expect(root.querySelector('.unread-badge')?.textContent?.trim()).toBe('2');
  root.querySelector<HTMLElement>('.sidebar-bottom .text-danger')!.click();
  expect(logout).toHaveBeenCalledOnce();
});
