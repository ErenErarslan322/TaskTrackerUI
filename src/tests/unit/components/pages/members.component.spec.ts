import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { Team } from '../../../../app/features/teams/member.model';
import { MembersComponent } from '../../../../app/features/teams/members.component';
import { AuthService } from '../../../../app/features/auth/auth.service';
import { PageSearchService } from '../../../../app/core/search/page-search.service';
import { TeamService } from '../../../../app/features/teams/team.service';
import { member, session, team } from '../../../support/fixtures';

it('shows roles, filters the selected roster and only clears successful form submissions', () => {
  const roster = team({ members: [
    member({ id: 1, name: 'test-owner', role: 'Kurucu' }),
    member({ name: 'İpek', email: 'ipek@example.test', role: 'Yönetici' }),
    member({ id: 3, name: 'Deniz', role: 'Takım Üyesi' })
  ] });
  const selectedTeam = signal<Team | null>(roster);
  const query = signal('');
  const canManageSelectedTeam = signal(true);
  const isSelectedTeamOwner = signal(true);
  const createTeam = vi.fn((_name: string, _onSuccess: () => void) => {});
  const inviteMember = vi.fn((_email: string, _onSuccess?: () => void) => {});
  TestBed.configureTestingModule({
    imports: [MembersComponent],
    providers: [
      { provide: AuthService, useValue: session('test-owner') },
      { provide: PageSearchService, useValue: { queryFor: query } },
      { provide: TeamService, useValue: {
        myTeams: () => [roster], selectedTeam, canManageSelectedTeam, isSelectedTeamOwner,
        getStatusColor: () => '', createTeam, inviteMember
      } }
    ]
  });
  const fixture = TestBed.createComponent(MembersComponent);
  const page = fixture.componentInstance;
  const root = fixture.nativeElement as HTMLElement;
  fixture.detectChanges();
  expect(root.querySelectorAll('.member-item')).toHaveLength(3);
  expect(root.querySelectorAll('[title="Takımdan Çıkar"]')).toHaveLength(2);
  expect(root.querySelector('.member-item')?.textContent).toContain('Kurucu');
  expect(root.textContent).toContain('Takım Üyesi');

  query.set('ipek@example');
  fixture.detectChanges();
  expect(root.querySelectorAll('.member-item')).toHaveLength(1);
  expect(root.querySelector('.member-item')?.textContent).toContain('Yönetici');
  expect(root.querySelector('.member-item')?.textContent).not.toContain('ipek@example.test');
  query.set('no-match');
  fixture.detectChanges();
  expect(root.querySelector('[role=status]')?.textContent).toContain('Aramanıza uyan üye bulunamadı.');

  page.newTeamName = 'Yeni takım';
  page.newMemberEmail = 'new@example.test';
  page.createTeam();
  page.inviteMember();
  expect(page.newTeamName).toBe('Yeni takım');
  expect(page.newMemberEmail).toBe('new@example.test');
  createTeam.mock.calls[0][1]();
  inviteMember.mock.calls[0][1]!();
  expect(page.newTeamName).toBe('');
  expect(page.newMemberEmail).toBe('');

  query.set('');
  isSelectedTeamOwner.set(false);
  fixture.detectChanges();
  expect(root.querySelector('input[type=email]')).not.toBeNull();
  expect(root.querySelector('[title="Takımdan Çıkar"]')).toBeNull();

  canManageSelectedTeam.set(false);
  fixture.detectChanges();
  expect(root.querySelector('input[type=email]')).toBeNull();
  expect(root.textContent).toContain('Takımdan Ayrıl');
  selectedTeam.set(null);
  fixture.detectChanges();
  expect(root.textContent).toContain('Henüz Bir Takımda Değilsiniz');
});
