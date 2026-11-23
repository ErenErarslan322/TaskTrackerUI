import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { TaskService } from '../tasks/task.service';
import { isTaskOverdue } from '../tasks/task-deadline';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-content">
      <div class="welcome-banner">
        <div>
          <h2>Hoş Geldin, {{ authService.currentUser() }}! 👋</h2>
          <p>Çalışma alanının bugünkü genel özeti.</p>
        </div>
        <div class="banner-icon">🚀</div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Bekleyen Görevler</h3>
          <div class="num" style="color: #eaff00 ;">{{ taskSummary().pending }}</div>
        </div>
        <div class="stat-card">
          <h3>Tamamlanan Görevler</h3>
          <div class="num" style="color: var(--green);">{{ taskSummary().completed }}</div>
        </div>
        <div class="stat-card">
          <h3>Tamamlanamadı</h3>
          <div class="num" style="color: #de350b;">{{ taskSummary().overdue }}</div>
       </div>
        <div class="stat-card">
          <h3>Toplam Görev</h3>
          <div class="num" style="color: var(--primary);">{{ taskSummary().total }}</div>
        </div>
      </div>
    </div>
  `
})
export class HomeComponent {
  readonly taskSummary = computed(() => {
    const tasks = this.taskService.tasks();
    const summary = { pending: 0, completed: 0, overdue: 0, total: tasks.length };

    for (const task of tasks) {
      if (task.isCompleted) {
        summary.completed++;
      } else if (isTaskOverdue(task.dueDate)) {
        summary.overdue++;
      } else {
        summary.pending++;
      }
    }
    return summary;
  });

  constructor(
    public authService: AuthService,
    private taskService: TaskService
  ) {}
}
