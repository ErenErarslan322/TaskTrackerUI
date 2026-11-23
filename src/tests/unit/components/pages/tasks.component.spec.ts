import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskItem } from '../../../../app/features/tasks/task.model';
import { TasksComponent } from '../../../../app/features/tasks/tasks.component';
import { AuthService } from '../../../../app/features/auth/auth.service';
import { TaskService } from '../../../../app/features/tasks/task.service';
import { TeamService } from '../../../../app/features/teams/team.service';
import { member, session, task, team } from '../../../support/fixtures';

describe('TasksComponent', () => {
  let fixture: ComponentFixture<TasksComponent>;
  const defaultTeam = team();
  const roster = team({ members: [
    ...defaultTeam.members,
    member({ id: 3, name: 'other-admin', role: 'Yönetici' }),
    member({ id: 4, name: 'other-member' })
  ] });
  const teams = signal([roster]);
  const auth = session('test-member');
  const selectedScope = signal('personal');
  const visibleTasks = signal<TaskItem[]>([]);
  const allowTeamManagement = signal(false);
  const addTask = vi.fn();
  const toggleComplete = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2030, 4, 15, 12));
    selectedScope.set('personal');
    teams.set([roster]);
    auth.currentUser.set('test-member');
    visibleTasks.set([]);
    allowTeamManagement.set(false);
    addTask.mockClear();
    toggleComplete.mockClear();
    TestBed.configureTestingModule({
      imports: [TasksComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: TeamService, useValue: { myTeams: teams, canManage: allowTeamManagement } },
        { provide: TaskService, useValue: {
          selectedScope, setScope: (scope: string) => selectedScope.set(scope), filteredTasks: visibleTasks,
          todoTasks: computed(() => visibleTasks().filter(item => !item.isCompleted)),
          doneTasks: computed(() => visibleTasks().filter(item => item.isCompleted)),
          failedTasks: () => [], selectedMemberFilter: signal('ALL'), activeFilter: signal(null),
          searchText: () => '', isOverdue: () => false, addTask, toggleComplete,
          canComplete: (item: TaskItem) => !item.teamId || item.assignedTo === 'test-member'
        } }
      ]
    });
    fixture = TestBed.createComponent(TasksComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('places dated tasks in the correct calendar cell and keeps undated tasks separate', () => {
    const page = fixture.componentInstance;
    visibleTasks.set([task({ id: 'due', dueDate: '2030-05-20T00:00:00' }), task({ id: 'undated' })]);
    expect(page.currentMonthLabel()).toBe('Mayıs 2030');
    expect(page.calendarDays()).toHaveLength(42);
    expect(page.calendarDays()[0].date.getDay()).toBe(1);
    expect(page.calendarDays().find(cell => cell.dateKey === '2030-05-20')?.tasks[0].id).toBe('due');
    expect(page.calendarDays().find(cell => cell.isToday)?.dateKey).toBe('2030-05-15');
    expect(page.undatedTasks().map(item => item.id)).toEqual(['undated']);

    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll<HTMLElement>('.view-tabs a')[1].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.calendar-cell')).toHaveLength(42);
    page.changeMonth(1);
    expect(page.currentMonthLabel()).toBe('Haziran 2030');
    page.goToToday();
    expect(page.currentMonthLabel()).toBe('Mayıs 2030');
  });

  it('rejects past dates and submits a valid task with the default assignee', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const page = fixture.componentInstance;
    expect(page.newTaskAssignee()).toBe('test-member');
    page.newTaskTitle = 'Yeni görev';
    page.newTaskDueDate = '2030-05-14';
    page.addTask();
    expect(alert).toHaveBeenCalledWith('Geçmiş bir tarih seçemezsiniz!');
    expect(addTask).not.toHaveBeenCalled();

    page.newTaskDueDate = '2030-05-15';
    page.addTask();
    expect(addTask).toHaveBeenCalledWith('Yeni görev', 2, '2030-05-15', 'test-member');
    expect(page.newTaskTitle).toBe('');
    expect(page.newTaskDueDate).toBe('');
  });

  it('restricts team task controls to authorized members', () => {
    const page = fixture.componentInstance;
    page.selectScope(roster.id);
    visibleTasks.set([
      task({ id: 'other', teamId: roster.id, assignedTo: 'test-owner' }),
      task({ id: 'own', teamId: roster.id, assignedTo: 'test-member' })
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.add-task-container')).toBeNull();
    expect(root.querySelectorAll('.delete-btn')).toHaveLength(0);
    const checkboxes = root.querySelectorAll<HTMLInputElement>('.k-card input[type=checkbox]');
    expect([...checkboxes].map(element => element.disabled)).toEqual([true, false]);
    checkboxes[1].click();
    expect(toggleComplete).toHaveBeenCalledWith(visibleTasks()[1]);

    allowTeamManagement.set(true);
    fixture.detectChanges();
    expect(root.querySelector('.add-task-container')).not.toBeNull();
    expect(root.querySelectorAll('.delete-btn')).toHaveLength(2);
  });

  it('lists other administrators and members for an administrator and rejects a founder assignment', () => {
    const page = fixture.componentInstance;
    allowTeamManagement.set(true);
    page.selectScope(roster.id);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const options = root.querySelectorAll<HTMLOptionElement>('select[title="Görev Atanacak Üye"] option');
    expect([...options].map(option => option.value)).toEqual(['other-admin', 'other-member']);
    expect(page.newTaskAssignee()).toBe('other-admin');

    page.newTaskTitle = 'Yeni görev';
    for (const disallowed of ['test-owner', 'test-member']) {
      page.newTaskAssignee.set(disallowed);
      page.addTask();
    }
    expect(addTask).not.toHaveBeenCalled();

    page.newTaskAssignee.set('other-admin');
    teams.set([{ ...roster, members: roster.members.filter(item => item.name !== 'other-admin') }]);
    expect(page.newTaskAssignee()).toBe('other-member');
    page.addTask();
    expect(addTask).toHaveBeenCalledWith('Yeni görev', 2, '', 'other-member');
  });

  it('lists all members for the founder and handles an administrator without an eligible recipient', () => {
    const page = fixture.componentInstance;
    allowTeamManagement.set(true);
    auth.currentUser.set('test-owner');
    page.selectScope(roster.id);
    expect(page.assignableMembers().map(item => item.name)).toEqual([
      'test-owner', 'test-member', 'other-admin', 'other-member'
    ]);
    expect(page.newTaskAssignee()).toBe('test-owner');

    auth.currentUser.set('test-member');
    teams.set([defaultTeam]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.add-task-container')).toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('görev atayabileceğiniz başka bir üye yok');
  });
});
