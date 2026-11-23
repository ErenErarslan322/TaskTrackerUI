import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesComponent } from '../../../../app/features/messages/messages.component';
import { AuthService } from '../../../../app/features/auth/auth.service';
import { PageSearchService } from '../../../../app/core/search/page-search.service';
import { SignalrService } from '../../../../app/core/realtime/signalr.service';
import { TeamService } from '../../../../app/features/teams/team.service';
import { member, message, session } from '../../../support/fixtures';

describe('MessagesComponent', () => {
  let fixture: ComponentFixture<MessagesComponent>;
  const query = signal('');
  const messages = signal([
    message({ sender: 'İpek', text: 'İş planı' }),
    message({ id: 'reply', sender: 'test-user', receiver: 'İpek', text: 'Tamam' }),
    message({ id: 'unrelated', sender: 'Deniz', receiver: 'third-user', text: 'Gizli iş planı' })
  ]);
  const activeChatUser = signal('');
  const markAsRead = vi.fn();
  const sendPrivateMessage = vi.fn();

  beforeEach(() => {
    query.set('');
    activeChatUser.set('');
    markAsRead.mockClear();
    sendPrivateMessage.mockClear();
    TestBed.configureTestingModule({
      imports: [MessagesComponent],
      providers: [
        { provide: AuthService, useValue: session() },
        { provide: PageSearchService, useValue: { queryFor: query } },
        { provide: TeamService, useValue: {
          otherMembers: () => ['Deniz', 'İpek', 'Test-Member'].map(name => member({ name })),
          getStatusColor: () => ''
        } },
        { provide: SignalrService, useValue: {
          messages, activeChatUser, markAsRead, sendPrivateMessage,
          getUnreadCount: (name: string) => name === 'İpek' ? 1 : 0,
          getLastMessageTime: (name: string) => name === 'Test-Member' ? 10 : 0
        } }
      ]
    });
    fixture = TestBed.createComponent(MessagesComponent);
    fixture.detectChanges();
  });

  it('ranks unread conversations first, then sorts by the latest message', () => {
    expect(fixture.componentInstance.sortedMembers().map(item => item.name))
      .toEqual(['İpek', 'Test-Member', 'Deniz']);
  });

  it('filters the active account conversations by name or message text', () => {
    const page = fixture.componentInstance;
    query.set('is plani');
    expect(page.sortedMembers().map(item => item.name)).toEqual(['İpek']);
    page.selectUser('İpek');
    expect(activeChatUser()).toBe('İpek');
    expect(markAsRead).toHaveBeenCalledWith('İpek');
    expect(page.currentChatMessages().map(item => item.text)).toEqual(['İş planı']);
    query.set('ipek');
    expect(page.currentChatMessages().map(item => item.text)).toEqual(['İş planı', 'Tamam']);
  });

  it('requires a selected conversation and a non-blank message before sending', () => {
    const page = fixture.componentInstance;
    page.messageText = 'Merhaba';
    page.send();
    expect(sendPrivateMessage).not.toHaveBeenCalled();
    page.selectUser('İpek');
    page.messageText = '   ';
    page.send();
    expect(sendPrivateMessage).not.toHaveBeenCalled();
    page.messageText = 'Merhaba';
    const root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('.btn-primary')!.click();
    expect(sendPrivateMessage).toHaveBeenCalledWith('test-user', 'İpek', 'Merhaba');
    expect(page.messageText).toBe('');
    fixture.destroy();
    expect(activeChatUser()).toBe('');
  });
});
