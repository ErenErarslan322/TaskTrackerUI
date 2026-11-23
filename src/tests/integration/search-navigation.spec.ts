import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { expect, it } from 'vitest';
import { routes } from '../../app/app.routes';
import { TopbarComponent } from '../../app/layout/topbar.component';
import { AuthService } from '../../app/features/auth/auth.service';
import { TaskService } from '../../app/features/tasks/task.service';
import { TeamService } from '../../app/features/teams/team.service';
import { member, message, session, task, team } from '../support/fixtures';

@Component({
  imports: [TopbarComponent, RouterOutlet],
  template: '<app-topbar /><router-outlet />'
})
class SearchHost {}

it('uses page-specific filters, clears the search on navigation and redirects unknown pages', async () => {
  localStorage.setItem('chatMessages', JSON.stringify([
    message({ sender: 'İpek', text: 'Çalışma planı' }),
    message({ id: 'reply', sender: 'test-user', receiver: 'İpek', text: 'Tamam' })
  ]));
  try {
    TestBed.configureTestingModule({
      imports: [SearchHost],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter(routes),
        { provide: AuthService, useValue: session() }
      ]
    });
    const fixture = TestBed.createComponent(SearchHost);
    const root = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    const input = () => root.querySelector<HTMLInputElement>('input[type=search]');
    TestBed.inject(TaskService).tasks.set([
      task({ id: 'planning', title: 'İş planı', priority: 3 }),
      task({ id: 'report', title: 'Rapor' }),
      task({ id: 'team-completed', teamId: 'test-team', isCompleted: true }),
      task({ id: 'team-overdue', teamId: 'test-team', dueDate: '2000-01-01' })
    ]);
    TestBed.inject(TeamService).loadTeams();
    http.expectOne('http://localhost:5032/api/teams').flush([team({
      owner: 'test-user',
      members: [
        member({ id: 1, name: 'test-user', role: 'Kurucu' }),
        member({ name: 'İpek', email: 'ipek@example.test' }),
        member({ id: 3, name: 'Deniz' })
      ]
    })]);

    async function navigate(url: string) {
      await router.navigateByUrl(url);
      fixture.detectChanges();
      await fixture.whenStable();
    }
    function search(value: string) {
      const field = input()!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
    }

    fixture.detectChanges();
    await navigate('/');
    expect(router.url).toBe('/tasks');
    search('is plani');
    expect([...root.querySelectorAll('.k-card h4')].map(el => el.textContent?.trim())).toEqual(['İş planı']);
    search('no-match');
    expect(root.querySelector('[role=status]')?.textContent).toContain('Aramanıza uyan görev bulunamadı.');
    search('');
    const highPriority = [...root.querySelectorAll<HTMLButtonElement>('.filter-btn')]
      .find(button => button.textContent.includes('Yüksek'))!;
    highPriority.click();
    fixture.detectChanges();
    expect([...root.querySelectorAll('.k-card h4')].map(el => el.textContent?.trim())).toEqual(['İş planı']);

    await navigate('/members');
    expect(input()?.value).toBe('');
    search('ipek@');
    expect(root.querySelectorAll('.member-item')).toHaveLength(1);
    expect(root.querySelector('.member-item')?.textContent).toContain('İpek');

    await navigate('/messages');
    expect(input()?.value).toBe('');
    search('calisma');
    const contact = root.querySelector<HTMLElement>('app-messages strong');
    expect(contact?.textContent).toContain('İpek');
    expect(root.querySelector('app-messages')?.textContent).not.toContain('Deniz');
    contact!.click();
    fixture.detectChanges();
    expect(root.querySelector('app-messages')?.textContent).toContain('Çalışma planı');
    expect(root.querySelector('app-messages')?.textContent).not.toContain('Tamam');

    await navigate('/home');
    expect(input()).toBeNull();
    expect([...root.querySelectorAll('.stat-card .num')].map(el => el.textContent?.trim()))
      .toEqual(['2', '1', '1', '4']);
    await navigate('/settings');
    expect(input()).toBeNull();
    await navigate('/unknown-page');
    expect(router.url).toBe('/tasks');
    expect(input()?.value).toBe('');
    http.verify();
  } finally {
    localStorage.removeItem('chatMessages');
  }
});
