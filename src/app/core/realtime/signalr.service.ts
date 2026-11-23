import { Injectable, signal, computed, DestroyRef } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { HUB_URL } from '../api-endpoints';
import { ChatMessage } from './chat-message.model';
import { TeamService } from '../../features/teams/team.service';
import { AuthService } from '../../features/auth/auth.service';
import { TaskService } from '../../features/tasks/task.service';
import { ProfileStatus } from '../../features/teams/member.model';
import { NotificationEvent, NotificationItem } from '../../features/notifications/notification.model';
import { NotificationService } from '../../features/notifications/notification.service';

type StoredChatMessage = ChatMessage & Required<Pick<ChatMessage, 'id' | 'createdAt' | 'notificationRead'>>;

@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private hubConnection?: HubConnection;
  private readonly MESSAGE_EXPIRY_MS = 12 * 60 * 60 * 1000;
  private expiryTimer?: number;

  messages = signal<StoredChatMessage[]>(this.loadValidMessages());
  activeChatUser = signal<string>(''); // Mesajlar ekranında o an açık olan sohbet
  private readonly activeUser = computed(() => this.authService.currentUser().trim().toLowerCase());

  readonly messageNotifications = computed<NotificationItem[]>(() => {
    const user = this.activeUser();
    if (!user) return [];

    return this.messages().filter(message =>
      this.isIncomingMessage(message, user) && !message.notificationRead
    ).map(message => ({
      id: message.id,
      kind: 'message',
      sender: message.sender,
      receivedAt: message.createdAt
    }));
  });

  // Aktif kullanıcıya gelmiş tüm okunmamış mesajların toplam sayısı
  totalUnreadCount = computed(() => {
    const user = this.activeUser();
    if (!user) return 0;

    return this.messages().filter(
      message => this.isIncomingMessage(message, user) && message.isRead === false
    ).length;
  });

  constructor(
    private teamService: TeamService,
    private authService: AuthService,
    private notifications: NotificationService,
    private taskService: TaskService,
    destroyRef: DestroyRef
  ) {
    this.scheduleExpiry(this.messages());
    const listeners = new AbortController();
    window.addEventListener('storage', event => {
      if (event.key === 'chatMessages' || event.key === null) this.refreshMessages();
    }, { signal: listeners.signal });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refreshMessages();
    }, { signal: listeners.signal });

    destroyRef.onDestroy(() => {
      listeners.abort();
      window.clearTimeout(this.expiryTimer);
    });
  }

  // Belirli bir kişiden gelen okunmamış mesaj sayısı
  getUnreadCount(senderName: string): number {
    const activeUser = (this.authService.currentUser() || '').trim().toLowerCase();
    const target = senderName.trim().toLowerCase();
    if (!activeUser || !target) return 0;

    return this.messages().filter(
      m => m.receiver.toLowerCase() === activeUser &&
           m.sender.toLowerCase() === target &&
           m.isRead === false
    ).length;
  }

  // Sıralama için bir kişiyle olan son mesajın zamanı
  getLastMessageTime(otherUser: string): number {
    const activeUser = (this.authService.currentUser() || '').trim().toLowerCase();
    const target = otherUser.trim().toLowerCase();
    let latest = 0;

    for (const m of this.messages()) {
      const isMatch =
        (m.sender.toLowerCase() === activeUser && m.receiver.toLowerCase() === target) ||
        (m.sender.toLowerCase() === target && m.receiver.toLowerCase() === activeUser);

      if (isMatch && m.createdAt > latest) {
        latest = m.createdAt;
      }
    }
    return latest;
  }

  // Sohbet açıldığında o kişiden gelen mesajları okundu yap
  markAsRead(senderName: string) {
    const activeUser = (this.authService.currentUser() || '').trim().toLowerCase();
    const target = senderName.trim().toLowerCase();
    if (!activeUser || !target) return;

    let changed = false;
    const updated = this.loadValidMessages().map(m => {
      if (
        m.receiver.toLowerCase() === activeUser &&
        m.sender.toLowerCase() === target &&
        m.isRead === false
      ) {
        changed = true;
        return { ...m, isRead: true };
      }
      return m;
    });

    if (changed) {
      this.saveMessages(updated);
    }
  }

  dismissMessageNotifications(ids: string[]) {
    const user = this.activeUser();
    if (!user || !ids.length) return;

    const dismissed = new Set(ids);
    const updated = this.loadValidMessages().map(message =>
      this.isIncomingMessage(message, user) && dismissed.has(message.id)
        ? { ...message, notificationRead: true }
        : message
    );
    this.saveMessages(updated);
  }

  private isIncomingMessage(message: ChatMessage, user: string): boolean {
    return message.receiver.toLowerCase() === user && message.sender.toLowerCase() !== user;
  }

  private loadValidMessages(): StoredChatMessage[] {
    const raw = localStorage.getItem('chatMessages');
    if (!raw) return [];

    const allMessages: ChatMessage[] = JSON.parse(raw);
    const now = Date.now();

    const validMessages = allMessages
      .map(message => this.normalizeMessage(message, now))
      .filter(message => now - message.createdAt < this.MESSAGE_EXPIRY_MS);
    const serialized = JSON.stringify(validMessages);
    if (serialized !== raw) localStorage.setItem('chatMessages', serialized);
    return validMessages;
  }

  private normalizeMessage(message: ChatMessage, now: number): StoredChatMessage {
    const id = message.id ?? crypto.getRandomValues(new Uint32Array(4)).join('-');
    const createdAt = typeof message.createdAt === 'number' && Number.isFinite(message.createdAt)
      ? message.createdAt
      : now;
    const notificationRead = message.notificationRead ?? (message.isRead !== false);
    return { ...message, id, createdAt, notificationRead };
  }

  private refreshMessages() {
    this.updateMessages(this.loadValidMessages());
  }

  private saveMessages(messages: StoredChatMessage[]) {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
    this.updateMessages(messages);
  }

  private updateMessages(messages: StoredChatMessage[]) {
    const previousIds = new Set(this.messages().map(message => message.id));
    const user = this.activeUser();
    this.messages.set(messages);
    this.scheduleExpiry(messages);
    if (user && messages.some(message =>
      !previousIds.has(message.id) && !message.notificationRead && this.isIncomingMessage(message, user)
    )) {
      this.notifications.ring();
    }
  }

  private scheduleExpiry(messages: StoredChatMessage[]) {
    window.clearTimeout(this.expiryTimer);
    if (!messages.length) return;

    const oldest = messages.reduce((earliest, message) => Math.min(earliest, message.createdAt), Infinity);
    const remaining = oldest + this.MESSAGE_EXPIRY_MS - Date.now();
    this.expiryTimer = window.setTimeout(() => this.refreshMessages(), Math.min(remaining, this.MESSAGE_EXPIRY_MS));
  }

  startConnection(username: string) {
    if (!username) return;
    if (this.hubConnection && this.hubConnection.state !== HubConnectionState.Disconnected) {
      return;
    }
    this.notifications.load();

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        withCredentials: true,
        accessTokenFactory: () => localStorage.getItem('token') ?? ''
      })
      .withAutomaticReconnect()
      .build();
    this.hubConnection = connection;

    const registerUser = () => {
      if (this.hubConnection === connection && this.authService.isLoggedIn() &&
          this.authService.currentUser() === username) {
        this.notifications.load();
        this.teamService.loadTeams();
        this.taskService.loadTasks();
        return connection.invoke('RegisterUser', username, this.teamService.profileStatus());
      }
      return Promise.resolve();
    };

    connection.onreconnected(async () => {
      await registerUser().catch(err => console.error('SignalR Bağlantı Hatası:', err));
    });
    connection.on('UserStatusChanged', (changedUser: string, newStatus: ProfileStatus) => {
      this.teamService.updateMemberStatusFromHub(changedUser, newStatus);
    });

    connection.on('ReceiveAllStatuses', (statuses: { [key: string]: ProfileStatus }) => {
      Object.keys(statuses).forEach(user => {
        this.teamService.updateMemberStatusFromHub(user, statuses[user]);
      });
    });

    connection.on('ReceiveNotification', (event: NotificationEvent) => {
      if (this.hubConnection === connection) {
        this.notifications.receive(event);
      }
    });

    connection.on('WorkspaceChanged', () => {
      if (this.hubConnection === connection) {
        this.teamService.loadTeams();
        this.taskService.loadTasks();
      }
    });

    connection.on('ReceiveMessage', (msg: ChatMessage) => {
      if (this.hubConnection !== connection) return;

      const activeUser = this.activeUser();
      const openChat = this.activeChatUser().trim().toLowerCase();
      const isIncoming = this.isIncomingMessage(msg, activeUser);

      // Alıcı şu an bu sohbetin içindeyse anında okundu say, değilse okunmamış (false) yap
      const isViewingThisChat = isIncoming && msg.sender.toLowerCase() === openChat;

      const now = Date.now();
      const message = this.normalizeMessage(msg, now);
      if (now - message.createdAt >= this.MESSAGE_EXPIRY_MS) return;

      const messages = this.loadValidMessages();
      if (messages.some(existing => existing.id === message.id)) {
        this.updateMessages(messages);
        if (isViewingThisChat) this.markAsRead(msg.sender);
        return;
      }

      const msgWithMeta = {
        ...message,
        isRead: isViewingThisChat,
        notificationRead: msg.sender.toLowerCase() === msg.receiver.toLowerCase()
      };

      this.saveMessages([...messages, msgWithMeta]);
    });

    connection.start().then(registerUser).catch(err => console.error('SignalR Bağlantı Hatası:', err));
  }

  broadcastStatusChange(username: string, newStatus: ProfileStatus) {
    if (this.hubConnection && this.hubConnection.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('ChangeUserStatus', username, newStatus)
        .catch(err => console.error('SignalR Durum Güncelleme Hatası:', err));
    }
  }

  sendPrivateMessage(sender: string, receiver: string, text: string) {
    if (!text.trim() || !receiver.trim()) return;
    if (this.hubConnection && this.hubConnection.state === HubConnectionState.Connected) {
      this.hubConnection.invoke('SendPrivateMessage', sender, receiver, text.trim());
    }
  }

  stopConnection(username: string) {
    this.activeChatUser.set('');
    const connection = this.hubConnection;
    this.hubConnection = undefined;
    if (!connection) return;

    const announceOffline = connection.state === HubConnectionState.Connected
      ? connection.invoke('ChangeUserStatus', username, 'Çevrimdışı')
      : Promise.resolve();
    announceOffline.finally(() => connection.stop())
      .catch(err => console.error('SignalR Bağlantı Kapatma Hatası:', err));
  }
}
