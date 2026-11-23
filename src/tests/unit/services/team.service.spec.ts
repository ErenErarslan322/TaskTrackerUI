import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../app/features/auth/auth.service';
import { TeamService } from '../../../app/features/teams/team.service';
import { member, session, team } from '../../support/fixtures';

it('uses the server roster after creating a team, inviting a user, and removing that user', () => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { currentUser: signal('eren') } }
    ]
  });
  const teams = TestBed.inject(TeamService);
  const http = TestBed.inject(HttpTestingController);
  const apiUrl = 'http://localhost:5032/api/teams';
  const refreshRoster = (members: { id: number; name: string; email: string; role: string }[]) =>
    http.expectOne({ method: 'GET', url: apiUrl }).flush([
      { id: 'server-team', name: 'Platform', owner: 'eren', members }
    ]);
  const owner = { id: 1, name: 'eren', email: 'eren@example.com', role: 'Kurucu' };
  const member = { id: 2, name: 'deniz', email: 'deniz@example.com', role: 'Takım Üyesi' };
  const afterCreate = vi.fn();

  teams.createTeam('Platform', afterCreate);
  const create = http.expectOne({ method: 'POST', url: apiUrl });
  expect(afterCreate).not.toHaveBeenCalled();
  expect(create.request.body).toEqual({ name: 'Platform' });
  create.flush({ id: 'server-team' });
  refreshRoster([owner]);
  expect(afterCreate).toHaveBeenCalledOnce();

  teams.inviteMember('deniz@example.com');
  const addition = http.expectOne({ method: 'POST', url: `${apiUrl}/server-team/members` });
  expect(addition.request.body).toEqual({ email: 'deniz@example.com' });
  addition.flush(null);
  refreshRoster([owner, member]);
  expect(teams.selectedTeam()?.members.map(member => member.name)).toContain('deniz');

  teams.removeMember('deniz');
  http.expectOne({ method: 'DELETE', url: `${apiUrl}/server-team/members/2` }).flush(null);
  refreshRoster([owner]);
  expect(teams.selectedTeam()?.members.map(member => member.name)).toEqual(['eren']);
  teams.removeMember('deniz');
  http.verify();
});

describe('TeamService permissions and workspace lifecycle', () => {
  const apiUrl = 'http://localhost:5032/api/teams';
  const roster = team();
  let auth: ReturnType<typeof session>;
  let service: TeamService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    auth = session('test-owner');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }]
    });
    service = TestBed.inject(TeamService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    http.verify();
  });

  function loadRoster() {
    service.loadTeams();
    http.expectOne(apiUrl).flush([roster]);
  }

  it('promotes a member using the server and prevents role changes by non-owners', () => {
    loadRoster();
    service.toggleAdminRole('TEST-MEMBER');
    const request = http.expectOne({
      method: 'PUT', url: `${apiUrl}/${roster.id}/members/2/role`
    });
    expect(request.request.body).toEqual({ isAdmin: true });
    request.flush(null);
    http.expectOne(apiUrl).flush([{ ...roster, members: [
      roster.members[0], { ...roster.members[1], role: 'Yönetici' },
      member({ id: 3, name: 'test-other-member' })
    ] }]);
    expect(service.selectedTeam()?.members[1].role).toBe('Yönetici');

    auth.currentUser.set('test-member');
    expect(service.canManageSelectedTeam()).toBe(true);
    service.toggleAdminRole('test-member');
    service.removeMember('test-owner');
    service.removeMember('test-other-member');
    http.expectNone(req => req.method !== 'GET');
  });

  it('requires confirmation before deleting a team and clears its selection after removal', () => {
    loadRoster();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    service.deleteTeam(roster.id);
    http.expectNone({ method: 'DELETE', url: `${apiUrl}/${roster.id}` });
    confirm.mockReturnValue(true);
    service.deleteTeam(roster.id);
    http.expectOne({ method: 'DELETE', url: `${apiUrl}/${roster.id}` }).flush(null);
    http.expectOne(apiUrl).flush([]);
    expect(service.selectedTeam()).toBeNull();
    expect(service.selectedTeamId()).toBe('');
  });

  it('allows leaving as a member and blocks invitations without permission', () => {
    auth.currentUser.set('test-member');
    loadRoster();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    service.inviteMember('someone@example.test');
    http.expectNone({ method: 'POST', url: `${apiUrl}/${roster.id}/members` });
    service.leaveTeam(roster.id);
    expect(confirm).toHaveBeenCalledOnce();
    http.expectOne({ method: 'DELETE', url: `${apiUrl}/${roster.id}/members/2` }).flush(null);
    http.expectOne(apiUrl).flush([]);
    expect(service.myTeams()).toEqual([]);
  });

  it('imports only legacy entries belonging to the active account', () => {
    const ownLegacy = { ...roster, id: 'team_100' };
    const anotherLegacy = team({ id: 'team_200', owner: 'another-user', members: [member()] });
    localStorage.setItem('taskTracker_allTeams', JSON.stringify([ownLegacy, anotherLegacy, roster]));
    const finished = vi.fn();
    service.importLegacyTeams(finished);
    const request = http.expectOne({ method: 'POST', url: `${apiUrl}/import` });
    expect(request.request.body).toEqual({
      id: 'team_100', name: roster.name, owner: roster.owner,
      members: [{ name: 'test-owner', role: 'Kurucu' }, { name: 'test-member', role: 'Takım Üyesi' }]
    });
    request.flush(null);
    expect(finished).toHaveBeenCalledOnce();
  });

  it('reflects presence changes without replacing the roster and ignores a cleared request', () => {
    loadRoster();
    service.selectProfileStatus('Dışarıda');
    service.updateMemberStatusFromHub(' Test-Member ', 'Çevrimiçi');
    expect(service.getPreferredStatus()).toBe('Dışarıda');
    expect(service.otherMembers()).toEqual([{ ...roster.members[1], status: 'Çevrimiçi' }]);

    service.loadTeams();
    const pending = http.expectOne(apiUrl);
    service.clearState();
    pending.flush([roster]);
    expect(service.myTeams()).toEqual([]);
    expect(service.otherMembers()).toEqual([]);
  });
});
