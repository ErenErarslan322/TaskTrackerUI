import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from '../../app/app.config';
import { AppComponent } from '../../app/app';
import { AuthService } from '../../app/features/auth/auth.service';
import { TaskService } from '../../app/features/tasks/task.service';
import { TeamService } from '../../app/features/teams/team.service';
import { task, team } from '../support/fixtures';
import { mockHub } from '../support/hub-double';

const apiUrl = 'http://localhost:5032/api';
const idleTimeout = 5 * 60 * 1000;

describe('Application session', () => {
  let fixture: ComponentFixture<AppComponent>;
  let http: HttpTestingController;
  let hub: ReturnType<typeof mockHub>;
  let root: HTMLElement;
  let auth: AuthService;
  let teams: TeamService;

  beforeEach(() => {
    localStorage.clear();
    hub = mockHub({ deferStart: true });
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [...appConfig.providers, provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    teams = TestBed.inject(TeamService);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
    hub.restore();
    localStorage.clear();
    http.verify();
  });

  function createApp() {
    fixture = TestBed.createComponent(AppComponent);
    root = fixture.nativeElement;
    fixture.detectChanges();
  }

  function resolveWorkspaceRequests() {
    const teamsRequest = http.expectOne(`${apiUrl}/teams`);
    const tasksRequest = http.expectOne(`${apiUrl}/tasks`);
    const inboxRequest = http.expectOne(`${apiUrl}/notifications`);
    for (const request of [teamsRequest, tasksRequest, inboxRequest]) {
      expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    }
    teamsRequest.flush([team()]);
    tasksRequest.flush([task()]);
    inboxRequest.flush([]);
    fixture.detectChanges();
  }

  function restoreSession() {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('username', 'test-user');
    localStorage.setItem('userId', '1');
    auth.isLoggedIn.set(true);
    auth.currentUser.set('test-user');
    createApp();
    resolveWorkspaceRequests();
  }

  it('loads the authenticated workspace on login and clears it when logging out from the sidebar', async () => {
    createApp();
    expect(root.querySelector('app-auth')).not.toBeNull();
    expect(root.querySelector('app-sidebar')).toBeNull();
    http.expectNone(`${apiUrl}/tasks`);

    auth.login({ username: 'test-user', password: 'test-password' }).subscribe();
    http.expectOne({ method: 'POST', url: `${apiUrl}/auth/login` })
      .flush({ username: 'test-user', token: 'test-token', userId: 1 });
    fixture.detectChanges();
    resolveWorkspaceRequests();
    expect(root.querySelector('app-auth')).toBeNull();
    expect(root.querySelector('app-sidebar')).not.toBeNull();
    expect(root.querySelector('.username')?.textContent).toContain('test-user');
    expect(hub.connection.start).toHaveBeenCalledOnce();
    expect(teams.myTeams()).toHaveLength(1);
    expect(TestBed.inject(TaskService).tasks()).toHaveLength(1);

    root.querySelector<HTMLElement>('.sidebar-bottom .text-danger')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(auth.isLoggedIn()).toBe(false);
    expect(root.querySelector('app-auth')).not.toBeNull();
    expect(root.querySelector('app-sidebar')).toBeNull();
    expect(teams.myTeams()).toEqual([]);
    expect(TestBed.inject(TaskService).tasks()).toEqual([]);
    expect(localStorage.getItem('token')).toBeNull();
    expect(hub.connection.invoke).toHaveBeenCalledWith('ChangeUserStatus', 'test-user', 'Çevrimdışı');
    expect(hub.connection.stop).toHaveBeenCalledOnce();
  });

  it('restarts the inactivity window on activity and reconnects the presence on return', () => {
    vi.useFakeTimers();
    restoreSession();
    vi.advanceTimersByTime(idleTimeout - 1000);
    expect(teams.profileStatus()).toBe('Çevrimiçi');

    window.dispatchEvent(new Event('pointermove'));
    vi.advanceTimersByTime(idleTimeout - 1);
    expect(teams.profileStatus()).toBe('Çevrimiçi');
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(teams.profileStatus()).toBe('Dışarıda');
    expect(teams.getPreferredStatus()).toBe('Çevrimiçi');
    expect(hub.connection.invoke).toHaveBeenCalledWith('ChangeUserStatus', 'test-user', 'Dışarıda');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(teams.profileStatus()).toBe('Çevrimiçi');
    expect(hub.connection.invoke).toHaveBeenLastCalledWith('ChangeUserStatus', 'test-user', 'Çevrimiçi');
  });

  it('keeps a manually away profile during activity until the user selects online', () => {
    vi.useFakeTimers();
    restoreSession();
    teams.selectProfileStatus('Dışarıda');
    fixture.detectChanges();

    hub.emit('UserStatusChanged', 'test-user', 'Çevrimiçi');
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new KeyboardEvent('keydown'));
    vi.advanceTimersByTime(idleTimeout * 2);
    expect(teams.profileStatus()).toBe('Dışarıda');
    expect(hub.connection.invoke).not.toHaveBeenCalledWith('ChangeUserStatus', 'test-user', 'Çevrimiçi');

    teams.selectProfileStatus('Çevrimiçi');
    fixture.detectChanges();
    vi.advanceTimersByTime(idleTimeout);
    expect(teams.profileStatus()).toBe('Dışarıda');
    window.dispatchEvent(new Event('pointerdown'));
    expect(teams.profileStatus()).toBe('Çevrimiçi');
  });

  it('starts online after logging out while manually away and signing back in', () => {
    restoreSession();
    teams.selectProfileStatus('Dışarıda');
    expect(teams.profileStatus()).toBe('Dışarıda');
    root.querySelector<HTMLElement>('.sidebar-bottom .text-danger')!.click();
    fixture.detectChanges();

    auth.login({ username: 'test-user', password: 'test-password' }).subscribe();
    http.expectOne({ method: 'POST', url: `${apiUrl}/auth/login` })
      .flush({ username: 'test-user', token: 'test-token', userId: 1 });
    fixture.detectChanges();
    resolveWorkspaceRequests();
    expect(teams.profileStatus()).toBe('Çevrimiçi');
  });

  it('preserves a manually offline profile even when the user interacts with the app', () => {
    vi.useFakeTimers();
    restoreSession();
    teams.changeStatus('Çevrimdışı');
    fixture.detectChanges();
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(idleTimeout * 2);
    expect(teams.profileStatus()).toBe('Çevrimdışı');
    expect(hub.connection.invoke).not.toHaveBeenCalledWith('ChangeUserStatus', 'test-user', 'Çevrimiçi');
  });
});
