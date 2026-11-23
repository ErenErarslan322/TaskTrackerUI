import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { TopbarComponent } from '../../../../app/layout/topbar.component';
import { AuthService } from '../../../../app/features/auth/auth.service';
import { NotificationService } from '../../../../app/features/notifications/notification.service';
import { PageSearchService } from '../../../../app/core/search/page-search.service';
import { SignalrService } from '../../../../app/core/realtime/signalr.service';
import { TeamService } from '../../../../app/features/teams/team.service';
import { TaskService } from '../../../../app/features/tasks/task.service';
import { TaskItem } from '../../../../app/features/tasks/task.model';
import { notification, session, task } from '../../../support/fixtures';

function createTopbar(tasks: TaskItem[] = []) {
  const item = notification();
  const notifications = signal([item]);
  const dismiss = vi.fn(() => notifications.set([]));
  const query = signal('test');
  TestBed.configureTestingModule({
    imports: [TopbarComponent],
    providers: [
      { provide: AuthService, useValue: session() },
      { provide: TeamService, useValue: { profileStatus: () => 'Çevrimiçi', getStatusColor: () => '' } },
      { provide: PageSearchService, useValue: { label: () => 'Görev başlığı ara', query } },
      { provide: NotificationService, useValue: { notifications, dismiss, ringingId: () => 0 } },
      { provide: TaskService, useValue: { tasks: signal(tasks) } },
      { provide: SignalrService, useValue: { messageNotifications: () => [], dismissMessageNotifications: vi.fn() } }
    ]
  });
  const fixture = TestBed.createComponent(TopbarComponent);
  const root = fixture.nativeElement as HTMLElement;
  fixture.detectChanges();
  return { fixture, root, dismiss, query, item };
}

it('captures the viewed notification list and closes it with Escape', () => {
  const { fixture, root, dismiss, query, item } = createTopbar();
  const bell = root.querySelector<HTMLButtonElement>('.notification-bell')!;
  expect(bell.getAttribute('aria-label')).toContain('1 okunmamış');
  bell.click();
  fixture.detectChanges();
  expect(dismiss).toHaveBeenCalledWith([item]);
  expect(bell.getAttribute('aria-expanded')).toBe('true');
  expect(root.querySelector('.notification-panel')?.textContent).toContain('Test görevi');
  expect(root.querySelector('.notification-dot')).toBeNull();

  bell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  fixture.detectChanges();
  expect(bell.getAttribute('aria-expanded')).toBe('false');
  expect(root.querySelector('.notification-panel')).toBeNull();
  fixture.destroy();
  expect(query()).toBe('');
});

it('shows open tasks by deadline, then by descending priority on the same day', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2030, 0, 31, 12));
  try {
    const { fixture, root, dismiss } = createTopbar([
      task({ id: 'low', title: 'Düşük bugün', priority: 1, dueDate: '2030-01-31' }),
      task({ id: 'mid', title: 'Orta yarın', priority: 2, dueDate: '2030-02-01' }),
      task({ id: 'high-later', title: 'Yüksek iki gün sonra', priority: 3, dueDate: '2030-02-02T00:00:00Z', teamId: 'test-team' }),
      task({ id: 'high-today', title: 'Yüksek bugün', priority: 3, dueDate: '2030-01-31' }),
      task({ id: 'mid-today', title: 'Orta bugün', priority: 2, dueDate: '2030-01-31T23:00:00Z' }),
      task({ id: 'late', dueDate: '2030-01-30' }),
      task({ id: 'too-far', dueDate: '2030-02-03' }),
      task({ id: 'completed', isCompleted: true, dueDate: '2030-02-01' }),
      task({ id: 'undated' })
    ]);
    const calendar = root.querySelector<HTMLButtonElement>('.upcoming-tasks-button')!;
    calendar.click();
    fixture.detectChanges();
    expect(calendar.getAttribute('aria-expanded')).toBe('true');
    expect([...root.querySelectorAll('.upcoming-task-list strong')].map(item => item.textContent))
      .toEqual(['Yüksek bugün', 'Orta bugün', 'Düşük bugün', 'Orta yarın', 'Yüksek iki gün sonra']);
    expect([...root.querySelectorAll('.upcoming-task-list time')].map(item => item.textContent))
      .toEqual(['31.01.2030', '31.01.2030', '31.01.2030', '01.02.2030', '02.02.2030']);
    expect(dismiss).not.toHaveBeenCalled();

    calendar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('#upcoming-tasks-panel')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
