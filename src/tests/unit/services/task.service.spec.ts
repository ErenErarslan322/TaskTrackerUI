import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../app/features/auth/auth.service';
import { PageSearchService } from '../../../app/core/search/page-search.service';
import { TaskService } from '../../../app/features/tasks/task.service';
import { TeamService } from '../../../app/features/teams/team.service';
import { session, task, team } from '../../support/fixtures';

const apiUrl = 'http://localhost:5032/api/tasks';

describe('TaskService', () => {
  let tasks: TaskService;
  let http: HttpTestingController;
  let auth: ReturnType<typeof session>;
  let teamIds: ReturnType<typeof signal<string[]>>;
  let query: ReturnType<typeof signal<string>>;
  const roster = team();
  const canManage = vi.fn(() => false);

  beforeEach(() => {
    auth = session();
    query = signal('');
    teamIds = signal([roster.id]);
    canManage.mockReset().mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: PageSearchService, useValue: { queryFor: query } },
        { provide: TeamService, useValue: { teamIds, myTeams: () => [roster], canManage } }
      ]
    });
    tasks = TestBed.inject(TaskService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('combines team, assignee, priority and normalized title filters', () => {
    const matching = task({ id: 'match', title: 'İş Önceliği', assignedTo: 'Test-User', teamId: roster.id, priority: 3 });
    tasks.tasks.set([
      matching,
      { ...matching, id: 'other-person', assignedTo: 'someone-else' },
      { ...matching, id: 'other-priority', priority: 1 },
      { ...matching, id: 'other-title', title: 'Rapor' },
      { ...matching, id: 'personal', teamId: null }
    ]);
    tasks.setScope(roster.id);
    tasks.selectedMemberFilter.set('TEST-USER');
    tasks.setFilter(3);
    query.set('is onceligi');
    expect(tasks.filteredTasks()).toEqual([matching]);

    teamIds.set([]);
    expect(tasks.selectedScope()).toBe('personal');
    expect(tasks.filteredTasks().map(item => item.id)).toEqual(['personal']);
  });

  it('treats the due date as valid through the end of its local day', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(new Date(2030, 4, 15, 23, 59, 59, 999).getTime());
    expect(tasks.isOverdue('2030-05-15T00:00:00')).toBe(false);
    expect(tasks.isOverdue(null)).toBe(false);
    now.mockReturnValue(new Date(2030, 4, 16, 0, 0, 0).getTime());
    expect(tasks.isOverdue('2030-05-15')).toBe(true);
    expect(tasks.isOverdue('2030-05-16')).toBe(false);
    const pending = task({ id: 'pending' });
    const overdue = task({ id: 'overdue', dueDate: '2030-05-15' });
    const completed = task({ id: 'completed', dueDate: '2030-05-15', isCompleted: true });
    tasks.tasks.set([pending, overdue, completed]);
    expect(tasks.todoTasks()).toEqual([pending]);
    expect(tasks.failedTasks()).toEqual([overdue]);
    expect(tasks.doneTasks()).toEqual([completed]);
  });

  it('ignores out-of-order responses and drops a pending response after clearing the session', () => {
    tasks.loadTasks();
    const older = http.expectOne(apiUrl);
    tasks.loadTasks();
    const newer = http.expectOne(apiUrl);
    newer.flush([task({ id: 'latest' })]);
    older.flush([task({ id: 'old' })]);
    expect(tasks.tasks().map(item => item.id)).toEqual(['latest']);

    tasks.loadTasks();
    const pending = http.expectOne(apiUrl);
    tasks.clearState();
    auth.currentUser.set('');
    pending.flush([task()]);
    expect(tasks.tasks()).toEqual([]);
    tasks.loadTasks();
    http.expectNone(apiUrl);
  });

  it('creates a team task using the selected scope and refreshes the list after saving', () => {
    tasks.addTask('   ', 2);
    http.expectNone(apiUrl);
    tasks.setScope(roster.id);
    tasks.addTask('  Rapor  ', 3, '2030-05-10', 'test-member');
    const request = http.expectOne({ method: 'POST', url: apiUrl });
    expect(request.request.body).toEqual({
      title: 'Rapor', priority: 3, dueDate: '2030-05-10', teamId: roster.id, assignedTo: 'test-member'
    });
    const saved = task({ title: 'Rapor', teamId: roster.id });
    request.flush(saved);
    http.expectOne({ method: 'GET', url: apiUrl }).flush([saved]);
    expect(tasks.tasks()).toEqual([saved]);
  });

  it('updates completion for the assignee or a manager and refreshes after a rejected change', () => {
    const assigned = task({ teamId: roster.id, assignedTo: 'TEST-USER' });
    const url = `${apiUrl}/${assigned.id}/completion`;
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    tasks.toggleComplete({ ...assigned, assignedTo: 'someone-else' });
    http.expectNone(url);

    tasks.toggleComplete(assigned);
    const completion = http.expectOne({ method: 'PATCH', url });
    expect(completion.request.body).toEqual({ isCompleted: true });
    completion.flush({ message: 'Bu işlem için yetkiniz yok.' }, { status: 403, statusText: 'Forbidden' });
    expect(alert).toHaveBeenCalledWith('Bu işlem için yetkiniz yok.');
    http.expectOne(apiUrl).flush([assigned]);
    expect(tasks.tasks()).toEqual([assigned]);
    canManage.mockReturnValue(true);
    expect(tasks.canComplete({ ...assigned, assignedTo: 'someone-else' })).toBe(true);
  });

  it('refreshes after deleting a task', () => {
    const item = task();
    tasks.tasks.set([item]);
    tasks.deleteTask(item.id);
    http.expectOne({ method: 'DELETE', url: `${apiUrl}/${item.id}` }).flush(null);
    http.expectOne({ method: 'GET', url: apiUrl }).flush([]);
    expect(tasks.tasks()).toEqual([]);
  });
});
