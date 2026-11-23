import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { HomeComponent } from '../../../../app/features/home/home.component';
import { AuthService } from '../../../../app/features/auth/auth.service';
import { TaskService } from '../../../../app/features/tasks/task.service';
import { session, task } from '../../../support/fixtures';

it('shows the active account and updates the task summary when the lists change', () => {
  const pending = task({ id: 'pending' });
  const complete = task({ id: 'complete', isCompleted: true });
  const overdue = task({ id: 'overdue', dueDate: '2000-01-01' });
  const tasks = signal([pending, complete, overdue]);
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      { provide: AuthService, useValue: session() },
      { provide: TaskService, useValue: { tasks } }
    ]
  });
  const fixture = TestBed.createComponent(HomeComponent);
  const root = fixture.nativeElement as HTMLElement;
  const counts = () => [...root.querySelectorAll('.stat-card .num')].map(el => el.textContent?.trim());
  fixture.detectChanges();
  expect(root.querySelector('.welcome-banner h2')?.textContent).toContain('test-user');
  expect(counts()).toEqual(['1', '1', '1', '3']);

  tasks.set([complete, overdue, { ...pending, isCompleted: true }]);
  fixture.detectChanges();
  expect(counts()).toEqual(['0', '2', '1', '3']);
});
