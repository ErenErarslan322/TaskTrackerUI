import { Injectable, inject, signal, computed, linkedSignal } from '@angular/core';
import { TaskApi } from './task.api';
import { TaskItem } from './task.model';
import { isTaskOverdue } from './task-deadline';
import { TeamService } from '../teams/team.service';
import { AuthService } from '../auth/auth.service';
import { normalizeSearchText, PageSearchService } from '../../core/search/page-search.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly api = inject(TaskApi);
  private requestVersion = 0;

  tasks = signal<TaskItem[]>([]);
  searchText = computed(() => this.pageSearch.queryFor('tasks'));
  activeFilter = signal<number | null>(null);

  // 'personal' -> sadece kişisel görevler, 'team_...' -> seçili takımın görevleri
  selectedScope = linkedSignal({
    source: () => this.teamService.teamIds(),
    computation: (ids, previous): string => previous && ids.includes(previous.value) ? previous.value : 'personal'
  });
  selectedMemberFilter = signal<string>('ALL');

  // Seçili kapsama (Kişisel veya Takım) ve üye filtresine göre süzülmüş görevler
  filteredTasks = computed(() => {
    const scope = this.selectedScope();
    const memberFilter = this.selectedMemberFilter().toLowerCase();
    const search = this.searchText();
    const priorityFilter = this.activeFilter();

    return this.tasks().filter(t => {
      const matchesScope = scope === 'personal' ? !t.teamId : t.teamId === scope;

      const matchesMember =
        scope === 'personal' ||
        memberFilter === 'all' ||
        (t.assignedTo || '').toLowerCase() === memberFilter;

      const matchesSearch = !search || normalizeSearchText(t.title).includes(search);
      const matchesPriority = priorityFilter === null || t.priority === priorityFilter;

      return matchesScope && matchesMember && matchesSearch && matchesPriority;
    });
  });

  todoTasks = computed(() =>
    this.filteredTasks().filter(t => !t.isCompleted && !this.isOverdue(t.dueDate))
  );

  failedTasks = computed(() =>
    this.filteredTasks().filter(t => !t.isCompleted && this.isOverdue(t.dueDate))
  );

  doneTasks = computed(() =>
    this.filteredTasks().filter(t => t.isCompleted)
  );

  constructor(
    private teamService: TeamService,
    private authService: AuthService,
    private pageSearch: PageSearchService
  ) {}

  isOverdue(dueDate?: string | null): boolean {
    return isTaskOverdue(dueDate);
  }

  loadTasks() {
    const user = this.authService.currentUser();
    if (!user) return;

    const version = ++this.requestVersion;
    this.api.list().subscribe({
      next: data => {
        if (version === this.requestVersion && user === this.authService.currentUser()) {
          this.tasks.set(data);
        }
      },
      error: (err) => console.error('Görevler yüklenirken hata:', err)
    });
  }

  addTask(title: string, priority: number, dueDate: string = '', assignedTo: string = '') {
    if (!title.trim()) return;
    const scope = this.selectedScope();

    const newTask = {
      title: title.trim(),
      dueDate: dueDate || null,
      priority: Number(priority),
      teamId: scope === 'personal' ? null : scope,
      assignedTo: assignedTo || null
    };

    this.api.create(newTask).subscribe({
      next: () => this.loadTasks(),
      error: err => window.alert(err.error?.message ?? 'Görev eklenemedi.')
    });
  }

  toggleComplete(task: TaskItem) {
    if (!this.canComplete(task)) return;
    this.api.setCompletion(task.id, !task.isCompleted).subscribe({
      next: () => this.loadTasks(),
      error: err => {
        this.loadTasks();
        window.alert(err.error?.message ?? 'Görevin durumu değiştirilemedi.');
      }
    });
  }

  canComplete(task: TaskItem): boolean {
    if (!task.teamId) return true;
    const team = this.teamService.myTeams().find(item => item.id === task.teamId);
    const username = this.authService.currentUser().toLowerCase();
    return !!team && (this.teamService.canManage(team) || task.assignedTo?.toLowerCase() === username);
  }

  deleteTask(id: string) {
    this.api.delete(id).subscribe({
      next: () => this.loadTasks(),
      error: err => window.alert(err.error?.message ?? 'Görev silinemedi.')
    });
  }

  setFilter(priority: number | null) {
    this.activeFilter.set(priority);
  }

  setScope(scope: string) {
    this.selectedScope.set(scope);
    this.selectedMemberFilter.set('ALL');
  }

  clearState() {
    this.requestVersion++;
    this.tasks.set([]);
    this.activeFilter.set(null);
    this.selectedScope.set('personal');
    this.selectedMemberFilter.set('ALL');
  }
}
