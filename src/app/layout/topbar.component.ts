import { Component, computed, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../features/auth/auth.service';
import { PageSearchService } from '../core/search/page-search.service';
import { TeamService } from '../features/teams/team.service';
import { NotificationItem } from '../features/notifications/notification.model';
import { NotificationService } from '../features/notifications/notification.service';
import { SignalrService } from '../core/realtime/signalr.service';
import { TaskService } from '../features/tasks/task.service';
import { getUpcomingTasks } from '../features/tasks/task-deadline';
import { getPriorityClass, getPriorityLabel } from '../features/tasks/task-priority';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="topbar">
      <div class="search-box" *ngIf="pageSearch.label() as label">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input
          #searchInput
          type="search"
          [value]="pageSearch.query()"
          (input)="pageSearch.query.set(searchInput.value)"
          [placeholder]="label"
          [attr.aria-label]="label" />
      </div>
      
      <div class="topbar-right">
        <div class="topbar-dropdown" (keydown.escape)="upcomingTasksOpen.set(false)">
          <button
            type="button"
            class="icon-btn upcoming-tasks-button"
            aria-label="Yaklaşan görevler"
            [attr.aria-expanded]="upcomingTasksOpen()"
            [attr.aria-controls]="upcomingTasksOpen() ? 'upcoming-tasks-panel' : null"
            (click)="toggleUpcomingTasks()">
            <span aria-hidden="true">📅</span>
          </button>
          @if (upcomingTasksOpen()) {
            <section class="topbar-panel" id="upcoming-tasks-panel" aria-labelledby="upcoming-tasks-title">
              <h2 id="upcoming-tasks-title">Yaklaşan görevler</h2>
              <ul class="topbar-panel-list upcoming-task-list">
                @for (task of upcomingTasks(); track task.id) {
                  <li>
                    <strong>{{ task.title }}</strong>
                    <div class="upcoming-task-details">
                      <span class="tag" [ngClass]="getPriorityClass(task.priority)">{{ getPriorityLabel(task.priority) }}</span>
                      <time [attr.datetime]="task.dueDate">{{ task.dueDate | date:'dd.MM.yyyy' }}</time>
                    </div>
                  </li>
                } @empty {
                  <li>Bugün ve önümüzdeki 2 gün içinde bitmesi gereken açık görev yok.</li>
                }
              </ul>
            </section>
          }
        </div>
        <div class="topbar-dropdown" (keydown.escape)="notificationsOpen() && toggleNotifications()">
          <button
            type="button"
            class="icon-btn notification-bell"
            (click)="toggleNotifications()"
            [attr.aria-expanded]="notificationsOpen()"
            [attr.aria-controls]="notificationsOpen() ? 'notification-panel' : null"
            [attr.aria-label]="unreadCount() ? 'Bildirimler, ' + unreadCount() + ' okunmamış' : 'Bildirimler'">
            @for (delivery of [notifications.ringingId()]; track delivery) {
              <span class="notification-bell-icon" [class.ringing]="delivery && unreadCount()" aria-hidden="true">🔔</span>
            }
            @if (unreadCount()) {
              <span class="notification-dot" aria-hidden="true"></span>
            }
          </button>
          @if (notificationsOpen()) {
            <section class="topbar-panel notification-panel" id="notification-panel" aria-labelledby="notification-title">
              <h2 id="notification-title">Bildirimler</h2>
              <ul class="topbar-panel-list notification-list">
                @for (item of displayedNotifications(); track item.id) {
                  <li>
                    <span>
                      @switch (item.kind) {
                        @case ('message') { <strong>{{ item.sender }}</strong> sana mesaj gönderdi. }
                        @case ('team-invitation') { <strong>{{ item.sender }}</strong> seni {{ item.subject }} takımına ekledi. }
                        @case ('team-removal') { <strong>{{ item.sender }}</strong> seni {{ item.subject }} takımından çıkardı. }
                        @case ('task-assignment') { <strong>{{ item.sender }}</strong> sana “{{ item.subject }}” görevini atadı. }
                      }
                    </span>
                    @if (item.receivedAt) {
                      <small>{{ item.receivedAt | date:'dd.MM HH:mm' }}</small>
                    }
                  </li>
                } @empty {
                  <li>Henüz bildirim yok.</li>
                }
              </ul>
            </section>
          }
        </div>
        <div class="user-profile">
          <div style="position: relative;">
            <div class="avatar">{{ (authService.currentUser() || 'K').charAt(0).toUpperCase() }}</div>
            <div class="status-indicator" [style.background]="teamService.getStatusColor(teamService.profileStatus())"></div>
          </div>
          <span class="username">{{ authService.currentUser() }}</span>
        </div>
      </div>
    </header>
  `
})
export class TopbarComponent implements OnDestroy {
  readonly getPriorityClass = getPriorityClass;
  readonly getPriorityLabel = getPriorityLabel;
  readonly upcomingTasksOpen = signal(false);
  readonly upcomingTasks = computed(() =>
    this.upcomingTasksOpen() ? getUpcomingTasks(this.taskService.tasks(), new Date()) : []
  );
  private readonly openNotifications = signal<NotificationItem[] | null>(null);
  readonly notificationsOpen = computed(() => this.openNotifications() !== null);
  private readonly pendingNotifications = computed(() => [
    ...this.notifications.notifications(),
    ...this.signalrService.messageNotifications()
  ]);
  readonly unreadCount = computed(() => this.pendingNotifications().length);
  readonly displayedNotifications = computed(() => [
    ...(this.openNotifications() ?? []),
    ...this.pendingNotifications()
  ].sort((a, b) => b.receivedAt - a.receivedAt));

  constructor(
    public authService: AuthService,
    public pageSearch: PageSearchService,
    public teamService: TeamService,
    public notifications: NotificationService,
    private signalrService: SignalrService,
    private taskService: TaskService
  ) {}

  toggleUpcomingTasks() {
    this.openNotifications.set(null);
    this.upcomingTasksOpen.update(open => !open);
  }

  toggleNotifications() {
    this.upcomingTasksOpen.set(false);
    this.openNotifications.set(this.notificationsOpen() ? null : this.pendingNotifications());
    const items = this.notifications.notifications();
    const messages = this.signalrService.messageNotifications();
    this.notifications.dismiss(items);
    this.signalrService.dismissMessageNotifications(messages.map(message => message.id));
  }

  ngOnDestroy() {
    this.pageSearch.query.set('');
  }
}
