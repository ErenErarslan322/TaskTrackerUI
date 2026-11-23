import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../../core/api-endpoints';
import { NotificationEvent } from './notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/notifications`;

  list() {
    return this.http.get<NotificationEvent[]>(this.url);
  }

  dismiss(ids: string[]) {
    return this.http.post<void>(`${this.url}/dismiss`, ids);
  }
}
