import { Component, signal, computed, linkedSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from './task.service';
import { TeamService } from '../teams/team.service';
import { AuthService } from '../auth/auth.service';
import { TaskItem } from './task.model';
import { formatDateKey } from './task-deadline';
import { getPriorityClass, getPriorityLabel } from './task-priority';
import { getAssignableMembers } from '../teams/team-permissions';

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: TaskItem[];
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html'
})
export class TasksComponent {
  viewMode = signal<'board' | 'calendar'>('board');
  currentMonth = signal<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  newTaskTitle = '';
  newTaskPriority = 2;
  newTaskDueDate = '';

  activeTeam = computed(() => {
    const scope = this.taskService.selectedScope();
    if (scope === 'personal') return null;
    return this.teamService.myTeams().find(t => t.id === scope) || null;
  });

  canAssignTasks = computed(() => {
    const team = this.activeTeam();
    return !team || this.teamService.canManage(team);
  });

  readonly assignableMembers = computed(() => {
    const team = this.activeTeam();
    if (!team || !this.canAssignTasks()) return [];
    return getAssignableMembers(team, this.authService.currentUser());
  });

  readonly newTaskAssignee = linkedSignal({
    source: () => ({
      teamId: this.activeTeam()?.id,
      candidates: this.assignableMembers(),
      username: this.authService.currentUser()
    }),
    computation: ({ teamId, candidates, username }, previous): string => {
      if (!teamId) return username;
      if (previous && previous.source.teamId === teamId &&
          candidates.some(member => member.name === previous.value)) {
        return previous.value;
      }
      return candidates[0]?.name ?? '';
    }
  });

  currentMonthLabel = computed(() => {
    const d = this.currentMonth();
    return `${this.monthNames[d.getMonth()]} ${d.getFullYear()}`;
  });

  undatedTasks = computed(() =>
    this.taskService.filteredTasks().filter(t => !t.dueDate)
  );

  calendarDays = computed<CalendarDay[]>(() => {
    const base = this.currentMonth();
    const year = base.getFullYear();
    const month = base.getMonth();
    const tasks = this.taskService.filteredTasks();

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Pazartesi = 0
    const todayKey = this.todayDate;

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(year, month, 1 - startOffset + i);
      const key = formatDateKey(cellDate);
      const dayTasks = tasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === key);

      days.push({
        date: cellDate,
        dateKey: key,
        dayNumber: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === month,
        isToday: key === todayKey,
        tasks: dayTasks
      });
    }
    return days;
  });

  constructor(
    public taskService: TaskService,
    public teamService: TeamService,
    public authService: AuthService
  ) {}

  get todayDate(): string {
    return formatDateKey(new Date());
  }

  selectScope(scope: string) {
    this.taskService.setScope(scope);
  }

  addTask() {
    const assignee = this.newTaskAssignee();
    if (!this.canAssignTasks() ||
        (this.activeTeam() && !this.assignableMembers().some(member => member.name === assignee))) {
      return;
    }

    if (this.newTaskDueDate && this.newTaskDueDate < this.todayDate) {
      alert('Geçmiş bir tarih seçemezsiniz!');
      return;
    }

    this.taskService.addTask(
      this.newTaskTitle,
      this.newTaskPriority,
      this.newTaskDueDate,
      assignee
    );
    this.newTaskTitle = '';
    this.newTaskPriority = 2;
    this.newTaskDueDate = '';
  }

  canDeleteTask(task: TaskItem): boolean {
    if (!this.activeTeam()) return true;
    return this.canAssignTasks();
  }

  changeMonth(delta: number) {
    const d = this.currentMonth();
    this.currentMonth.set(new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  goToToday() {
    const now = new Date();
    this.currentMonth.set(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  getCalendarTaskClass(task: TaskItem): string {
    if (task.isCompleted) return 'cal-done';
    if (this.taskService.isOverdue(task.dueDate) || task.priority === 3) return 'cal-high';
    if (task.priority === 2) return 'cal-mid';
    return 'cal-low';
  }

  readonly getPriorityLabel = getPriorityLabel;
  readonly getPriorityClass = getPriorityClass;
}
