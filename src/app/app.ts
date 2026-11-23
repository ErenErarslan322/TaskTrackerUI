import { Component, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './features/auth/auth.service';
import { TaskService } from './features/tasks/task.service';
import { TeamService } from './features/teams/team.service';
import { SignalrService } from './core/realtime/signalr.service';

import { AuthComponent } from './features/auth/auth.component';
import { SidebarComponent } from './layout/sidebar.component';
import { TopbarComponent } from './layout/topbar.component';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    AuthComponent,
    SidebarComponent,
    TopbarComponent
  ],
  templateUrl: './app.html'
})
export class AppComponent {
  constructor(
    public authService: AuthService,
    public taskService: TaskService,
    public teamService: TeamService,
    private signalrService: SignalrService,
    private router: Router
  ) {
    effect(() => {
      const loggedIn = this.authService.isLoggedIn();
      const user = this.authService.currentUser();

      untracked(() => {
        if (loggedIn && user) {
          this.teamService.changeStatus(this.teamService.getPreferredStatus());
          this.teamService.loadTeams();
          this.taskService.loadTasks();
          this.signalrService.startConnection(user);
          this.teamService.importLegacyTeams(() => {
            this.teamService.loadTeams();
            this.taskService.loadTasks();
          });
        } else {
          this.teamService.clearState();
          this.taskService.clearState();
        }
      });
    });

    effect(onCleanup => {
      const user = this.authService.currentUser();
      const status = this.teamService.profileStatus();
      if (!user || !this.authService.isLoggedIn() || status === 'Çevrimdışı') {
        return;
      }

      const listeners = new AbortController();
      let lastActivityAt = Date.now();
      let timeoutId: number | undefined;

      const isCurrentSession = () =>
        this.authService.isLoggedIn() && this.authService.currentUser() === user;
      const recordActivity = () => {
        lastActivityAt = Date.now();
        if (isCurrentSession() && this.teamService.profileStatus() === 'Dışarıda' &&
            this.teamService.getPreferredStatus() !== 'Dışarıda') {
          this.teamService.changeStatus('Çevrimiçi');
          this.signalrService.broadcastStatusChange(user, 'Çevrimiçi');
        }
      };
      const checkInactivity = () => {
        window.clearTimeout(timeoutId);
        if (!isCurrentSession() || this.teamService.profileStatus() !== 'Çevrimiçi') {
          return;
        }

        const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);
        if (remaining > 0) {
          timeoutId = window.setTimeout(checkInactivity, remaining);
          return;
        }

        this.teamService.changeStatus('Dışarıda');
        this.signalrService.broadcastStatusChange(user, 'Dışarıda');
      };

      for (const event of ACTIVITY_EVENTS) {
        window.addEventListener(event, recordActivity, {
          capture: true,
          passive: true,
          signal: listeners.signal
        });
      }
      if (status === 'Çevrimiçi') {
        document.addEventListener('visibilitychange', checkInactivity, { signal: listeners.signal });
        timeoutId = window.setTimeout(checkInactivity, IDLE_TIMEOUT_MS);
      }

      onCleanup(() => {
        listeners.abort();
        window.clearTimeout(timeoutId);
      });
    });
  }

  logout() {
    const user = this.authService.currentUser();
    this.teamService.clearPreferredStatus();
    this.teamService.changeStatus('Çevrimdışı');
    this.signalrService.stopConnection(user);
    this.authService.logout();
    this.teamService.clearState();
    this.taskService.clearState();
    this.router.navigate(['/tasks']);
  }
}
