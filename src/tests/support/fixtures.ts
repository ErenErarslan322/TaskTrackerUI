import { signal } from '@angular/core';
import { Team, TeamMember } from '../../app/features/teams/member.model';
import { TaskItem } from '../../app/features/tasks/task.model';
import { NotificationEvent } from '../../app/features/notifications/notification.model';
import { ChatMessage } from '../../app/core/realtime/chat-message.model';

export function session(username = 'test-user') {
  return { currentUser: signal(username), isLoggedIn: signal(Boolean(username)) };
}

export function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 'test-task', title: 'Test görevi', description: '', priority: 2,
    userId: 1, isCompleted: false, teamId: null, ...overrides
  };
}

export function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 2, name: 'test-member', email: 'member@example.test',
    role: 'Takım Üyesi', status: 'Çevrimdışı', ...overrides
  };
}

export function team(overrides: Partial<Team> = {}): Team {
  return {
    id: 'test-team',
    name: 'Test takımı',
    owner: 'test-owner',
    members: [member({ id: 1, name: 'test-owner', role: 'Kurucu' }), member()],
    ...overrides
  };
}

export function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'test-message', sender: 'test-member', receiver: 'test-user',
    text: 'Test mesajı', timestamp: '12:00', createdAt: Date.now(), isRead: false, ...overrides
  };
}

export function notification(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: 'test-notification', kind: 'task-assignment', sender: 'test-owner',
    subject: 'Test görevi', receivedAt: Date.now(), ...overrides
  };
}
