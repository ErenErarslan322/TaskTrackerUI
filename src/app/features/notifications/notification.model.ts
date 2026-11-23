export interface NotificationEvent {
  id: string;
  kind: 'team-invitation' | 'team-removal' | 'task-assignment';
  sender: string;
  subject?: string;
  receivedAt: number;
}

export interface NotificationItem extends Omit<NotificationEvent, 'kind'> {
  kind: NotificationEvent['kind'] | 'message';
  legacy?: true;
}
