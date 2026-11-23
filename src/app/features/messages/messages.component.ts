import { Component, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { TeamService } from '../teams/team.service';
import { SignalrService } from '../../core/realtime/signalr.service';
import { normalizeSearchText, PageSearchService } from '../../core/search/page-search.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.component.html'
})
export class MessagesComponent implements OnDestroy {
  selectedUser = signal<string>('');
  messageText = '';

  currentUserLower = computed(() => (this.authService.currentUser() || '').trim().toLowerCase());
  searchQuery = computed(() => this.pageSearch.queryFor('messages'));

  // Okunmamış mesajı olanları en üste, ardından son mesajlaşma saatine göre sırala
  sortedMembers = computed(() => {
    const messages = this.signalrService.messages();
    const query = this.searchQuery();
    const matchingUsers = new Set<string>();
    if (query) {
      const active = this.currentUserLower();
      for (const message of messages) {
        const sender = message.sender.toLowerCase();
        const receiver = message.receiver.toLowerCase();
        if (sender !== active && receiver !== active) continue;
        if (normalizeSearchText(message.text).includes(query)) {
          matchingUsers.add(sender === active ? receiver : sender);
        }
      }
    }

    const members = this.teamService.otherMembers().filter(member =>
      !query || normalizeSearchText(member.name).includes(query) || matchingUsers.has(member.name.toLowerCase())
    );

    return members.sort((a, b) => {
      const unreadA = this.signalrService.getUnreadCount(a.name);
      const unreadB = this.signalrService.getUnreadCount(b.name);

      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadB > 0 && unreadA === 0) return 1;

      const timeA = this.signalrService.getLastMessageTime(a.name);
      const timeB = this.signalrService.getLastMessageTime(b.name);
      return timeB - timeA;
    });
  });

  currentChatMessages = computed(() => {
    const active = this.currentUserLower();
    const target = this.selectedUser().trim().toLowerCase();
    const query = this.searchQuery();
    const filterByText = query && !normalizeSearchText(target).includes(query);
    return this.signalrService.messages().filter(message => {
      const sender = message.sender.toLowerCase();
      const receiver = message.receiver.toLowerCase();
      const inConversation = (sender === active && receiver === target) ||
        (sender === target && receiver === active);
      return inConversation && (!filterByText || normalizeSearchText(message.text).includes(query));
    });
  });

  constructor(
    public authService: AuthService,
    public teamService: TeamService,
    public signalrService: SignalrService,
    private pageSearch: PageSearchService
  ) {}

  selectUser(username: string) {
    this.selectedUser.set(username);
    this.signalrService.activeChatUser.set(username);
    this.signalrService.markAsRead(username);
  }

  send() {
    if (!this.messageText.trim() || !this.selectedUser()) return;
    this.signalrService.sendPrivateMessage(
      this.authService.currentUser(),
      this.selectedUser(),
      this.messageText
    );
    this.messageText = '';
  }

  ngOnDestroy() {
    this.signalrService.activeChatUser.set('');
  }
}
