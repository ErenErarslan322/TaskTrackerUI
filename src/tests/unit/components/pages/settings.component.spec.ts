import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { ProfileStatus } from '../../../../app/features/teams/member.model';
import { SettingsComponent } from '../../../../app/features/settings/settings.component';
import { AuthService } from '../../../../app/features/auth/auth.service';
import { SignalrService } from '../../../../app/core/realtime/signalr.service';
import { TeamService } from '../../../../app/features/teams/team.service';
import { session } from '../../../support/fixtures';

it('displays the account name and broadcasts the selected presence status', async () => {
  const profileStatus = signal<ProfileStatus>('Çevrimiçi');
  const selectProfileStatus = vi.fn((status: ProfileStatus) => profileStatus.set(status));
  const broadcastStatusChange = vi.fn();
  TestBed.configureTestingModule({
    imports: [SettingsComponent],
    providers: [
      { provide: AuthService, useValue: session() },
      { provide: TeamService, useValue: { profileStatus, selectProfileStatus } },
      { provide: SignalrService, useValue: { broadcastStatusChange } }
    ]
  });
  const fixture = TestBed.createComponent(SettingsComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const username = root.querySelector<HTMLInputElement>('input')!;
  const select = root.querySelector<HTMLSelectElement>('select')!;
  expect(username.disabled).toBe(true);
  expect(username.value).toBe('test-user');
  expect(select.value).toBe('Çevrimiçi');

  select.value = 'Dışarıda';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  expect(selectProfileStatus).toHaveBeenCalledWith('Dışarıda');
  expect(broadcastStatusChange).toHaveBeenCalledWith('test-user', 'Dışarıda');
});
