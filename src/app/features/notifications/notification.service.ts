import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { NotificationEvent, NotificationItem } from './notification.model';
import { NotificationApi } from './notification.api';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(NotificationApi);
  private readonly storageKey = computed(() => {
    const user = this.auth.currentUser().trim().toLowerCase();
    return this.auth.isLoggedIn() && user ? `taskTracker_notifications_${user}` : '';
  });
  private readonly items = linkedSignal({
    source: this.storageKey,
    computation: (key): NotificationItem[] => {
      if (!key) return [];
      try {
        const saved: (NotificationItem & { read?: boolean })[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        const unread = saved.filter(item => item.kind !== 'message' && item.read !== true);
        if (unread.length !== saved.length) {
          if (unread.length) localStorage.setItem(key, JSON.stringify(unread));
          else localStorage.removeItem(key);
        }
        return unread.map(item => ({ ...item, legacy: true as const }));
      } catch {
        return [];
      }
    }
  });
  private readonly dismissed = linkedSignal({
    source: this.storageKey,
    computation: key => new Set(this.pendingDismissals(key))
  });
  private readonly lastDelivery = signal<{ key: string; sequence: number } | null>(null);

  readonly notifications = this.items.asReadonly();
  readonly ringingId = computed(() => {
    const delivery = this.lastDelivery();
    return delivery?.key === this.storageKey() ? delivery.sequence : 0;
  });

  receive(event: NotificationEvent) {
    if (this.storageKey() && event.id) this.add([event]);
  }

  load() {
    const key = this.storageKey();
    if (!key) return;

    this.flushDismissals(key);
    this.api.list().subscribe({
      next: events => {
        if (key === this.storageKey()) this.add(events);
      },
      error: err => console.error('Bildirimler yüklenemedi:', err)
    });
  }

  ring() {
    const key = this.storageKey();
    if (key) {
      this.lastDelivery.update(delivery => ({ key, sequence: (delivery?.sequence ?? 0) + 1 }));
    }
  }

  dismiss(items: NotificationItem[]) {
    const key = this.storageKey();
    if (!key || !items.length) return;

    const ids = new Set(items.map(item => item.id));
    const remaining = this.items().filter(item => !ids.has(item.id));
    this.items.set(remaining);

    if (items.some(item => item.legacy)) {
      localStorage.setItem(key, JSON.stringify(remaining.filter(item => item.legacy)));
    }

    const serverIds = items.filter(item => !item.legacy).map(item => item.id);
    if (serverIds.length) {
      this.dismissed.update(previous => new Set([...previous, ...serverIds]));
      this.writePendingDismissals(key, [...new Set([...this.pendingDismissals(key), ...serverIds])]);
      this.flushDismissals(key);
    }
  }

  private add(events: NotificationEvent[]) {
    const hidden = this.dismissed();
    const items = new Map(this.items().map(item => [item.id, item]));
    const previousSize = items.size;
    for (const event of events) {
      if (!hidden.has(event.id)) items.set(event.id, event);
    }

    if (items.size > previousSize) {
      this.items.set([...items.values()]);
      this.ring();
    }
  }

  private pendingDismissals(key: string): string[] {
    if (!key) return [];
    try {
      return JSON.parse(localStorage.getItem(`${key}_pendingDismissals`) ?? '[]');
    } catch {
      return [];
    }
  }

  private writePendingDismissals(key: string, ids: string[]) {
    const storageKey = `${key}_pendingDismissals`;
    if (ids.length) localStorage.setItem(storageKey, JSON.stringify(ids));
    else localStorage.removeItem(storageKey);
  }

  private flushDismissals(key: string) {
    const ids = this.pendingDismissals(key);
    if (!ids.length) return;

    this.api.dismiss(ids).subscribe({
      next: () => this.writePendingDismissals(key, this.pendingDismissals(key).filter(id => !ids.includes(id))),
      error: err => console.error('Görülen bildirimler sunucudan silinemedi:', err)
    });
  }
}
