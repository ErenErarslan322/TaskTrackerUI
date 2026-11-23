import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HubConnectionState } from '@microsoft/signalr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../app/features/auth/auth.service';
import { NotificationService } from '../../../app/features/notifications/notification.service';
import { SignalrService } from '../../../app/core/realtime/signalr.service';
import { TaskService } from '../../../app/features/tasks/task.service';
import { TeamService } from '../../../app/features/teams/team.service';
import { message, notification, session } from '../../support/fixtures';
import { mockHub } from '../../support/hub-double';

describe('SignalrService', () => {
  let auth: ReturnType<typeof session>;
  let hub: ReturnType<typeof mockHub>;
  let workspace: { profileStatus: ReturnType<typeof signal<string>>; loadTeams: ReturnType<typeof vi.fn>; updateMemberStatusFromHub: ReturnType<typeof vi.fn> };
  let inbox: { load: ReturnType<typeof vi.fn>; ring: ReturnType<typeof vi.fn>; receive: ReturnType<typeof vi.fn> };
  let loadTasks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    auth = session();
    hub = mockHub();
    workspace = { profileStatus: signal('Çevrimiçi'), loadTeams: vi.fn(), updateMemberStatusFromHub: vi.fn() };
    inbox = { load: vi.fn(), ring: vi.fn(), receive: vi.fn() };
    loadTasks = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: TeamService, useValue: workspace },
        { provide: TaskService, useValue: { loadTasks } },
        { provide: NotificationService, useValue: inbox }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('opens one connection, registers on reconnect and responds to workspace and status events', async () => {
    const service = TestBed.inject(SignalrService);
    service.startConnection('');
    expect(hub.build).not.toHaveBeenCalled();
    service.startConnection('test-user');
    service.startConnection('test-user');
    await Promise.resolve();
    expect(hub.build).toHaveBeenCalledOnce();
    expect(hub.connection.invoke).toHaveBeenCalledWith('RegisterUser', 'test-user', 'Çevrimiçi');

    workspace.profileStatus.set('Dışarıda');
    await hub.reconnect();
    expect(hub.connection.invoke).toHaveBeenLastCalledWith('RegisterUser', 'test-user', 'Dışarıda');
    expect(inbox.load).toHaveBeenCalledTimes(3);
    workspace.loadTeams.mockClear();
    loadTasks.mockClear();
    hub.emit('WorkspaceChanged');
    expect(workspace.loadTeams).toHaveBeenCalledOnce();
    expect(loadTasks).toHaveBeenCalledOnce();

    hub.emit('ReceiveAllStatuses', { 'test-member': 'Çevrimiçi' });
    hub.emit('UserStatusChanged', 'test-member', 'Dışarıda');
    expect(workspace.updateMemberStatusFromHub).toHaveBeenNthCalledWith(1, 'test-member', 'Çevrimiçi');
    expect(workspace.updateMemberStatusFromHub).toHaveBeenNthCalledWith(2, 'test-member', 'Dışarıda');
    const event = notification();
    hub.emit('ReceiveNotification', event);
    expect(inbox.receive).toHaveBeenCalledWith(event);
  });

  it('counts unread messages by recipient and treats the open conversation as read', () => {
    const service = TestBed.inject(SignalrService);
    service.startConnection('test-user');
    const first = message();
    hub.emit('ReceiveMessage', first);
    hub.emit('ReceiveMessage', first);
    hub.emit('ReceiveMessage', message({ id: 'other', receiver: 'someone-else' }));
    expect(service.messages()).toHaveLength(2);
    expect(service.totalUnreadCount()).toBe(1);
    expect(service.getUnreadCount(' test-member ')).toBe(1);
    expect(inbox.ring).toHaveBeenCalledOnce();

    service.markAsRead('test-member');
    expect(service.getUnreadCount('test-member')).toBe(0);
    expect(service.getLastMessageTime('test-member')).toBe(first.createdAt);
    service.activeChatUser.set('test-member');
    hub.emit('ReceiveMessage', message({ id: 'open-chat' }));
    expect(service.totalUnreadCount()).toBe(0);
    expect(service.messageNotifications().map(item => item.id)).toEqual(['test-message', 'open-chat']);
    service.dismissMessageNotifications(['test-message']);
    expect(service.messageNotifications().map(item => item.id)).toEqual(['open-chat']);
  });

  it('expires stored messages at the 12-hour boundary and reloads updates from other tabs', () => {
    vi.useFakeTimers();
    const twelveHours = 12 * 60 * 60 * 1000;
    const now = Date.now();
    localStorage.setItem('chatMessages', JSON.stringify([
      message({ id: 'expired', createdAt: now - twelveHours }),
      message({ id: 'near-expiry', createdAt: now - twelveHours + 1000 })
    ]));
    const service = TestBed.inject(SignalrService);
    expect(service.messages().map(item => item.id)).toEqual(['near-expiry']);
    vi.advanceTimersByTime(999);
    expect(service.totalUnreadCount()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.messages()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('chatMessages')!)).toEqual([]);

    localStorage.setItem('chatMessages', JSON.stringify([message({ id: 'other-tab' })]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'chatMessages' }));
    expect(service.messages().map(item => item.id)).toEqual(['other-tab']);
  });

  it('keeps the recipient notification pending when the sender stores the message first', () => {
    const service = TestBed.inject(SignalrService);
    service.startConnection('test-user');
    hub.emit('ReceiveMessage', message({ sender: 'test-user', receiver: 'test-member' }));

    expect(service.messages()[0].notificationRead).toBe(false);
    expect(service.messageNotifications()).toEqual([]);
    expect(inbox.ring).not.toHaveBeenCalled();

    auth.currentUser.set('test-member');
    expect(service.totalUnreadCount()).toBe(1);
    expect(service.messageNotifications().map(item => item.id)).toEqual(['test-message']);
  });

  it('keeps a legacy message in the bell after opening its conversation', () => {
    localStorage.setItem('chatMessages', JSON.stringify([message()]));
    const service = TestBed.inject(SignalrService);

    service.markAsRead('test-member');
    expect(service.totalUnreadCount()).toBe(0);
    expect(service.messageNotifications().map(item => item.id)).toEqual(['test-message']);
  });

  it('sends valid commands while connected and closes the active conversation on logout', async () => {
    const service = TestBed.inject(SignalrService);
    service.startConnection('test-user');
    await Promise.resolve();
    hub.connection.invoke.mockClear();
    service.sendPrivateMessage('test-user', 'test-member', '   ');
    service.sendPrivateMessage('test-user', '   ', 'message');
    expect(hub.connection.invoke).not.toHaveBeenCalled();
    service.sendPrivateMessage('test-user', 'test-member', '  message  ');
    expect(hub.connection.invoke).toHaveBeenCalledWith('SendPrivateMessage', 'test-user', 'test-member', 'message');
    hub.connection.state = HubConnectionState.Disconnected;
    service.sendPrivateMessage('test-user', 'test-member', 'offline');
    expect(hub.connection.invoke).toHaveBeenCalledTimes(1);
    hub.connection.state = HubConnectionState.Connected;
    service.activeChatUser.set('test-member');
    service.stopConnection('test-user');
    expect(service.activeChatUser()).toBe('');
    expect(hub.connection.invoke).toHaveBeenLastCalledWith('ChangeUserStatus', 'test-user', 'Çevrimdışı');
    await Promise.resolve();
    expect(hub.connection.stop).toHaveBeenCalledOnce();
    hub.emit('ReceiveNotification', notification());
    expect(inbox.receive).not.toHaveBeenCalled();
  });
});
