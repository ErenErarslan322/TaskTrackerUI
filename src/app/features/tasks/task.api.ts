import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../../core/api-endpoints';
import { TaskItem } from './task.model';

export interface NewTask {
  title: string;
  dueDate: string | null;
  priority: number;
  teamId: string | null;
  assignedTo: string | null;
}

@Injectable({ providedIn: 'root' })
export class TaskApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/tasks`;

  list() {
    return this.http.get<TaskItem[]>(this.url);
  }

  create(task: NewTask) {
    return this.http.post<TaskItem>(this.url, task);
  }

  setCompletion(id: string, isCompleted: boolean) {
    return this.http.patch(`${this.url}/${id}/completion`, { isCompleted });
  }

  delete(id: string) {
    return this.http.delete(`${this.url}/${id}`);
  }
}
