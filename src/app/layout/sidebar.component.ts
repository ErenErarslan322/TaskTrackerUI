import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SignalrService } from '../core/realtime/signalr.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar" style="height: 100%;">
      <div class="logo-container">
        <span class="logo-icon" aria-hidden="true"></span>
        <h2>TaskTracker<span>+</span></h2>
      </div>
      
      <nav class="nav-menu">
        <a routerLink="/home" routerLinkActive="active" class="nav-item">
          <span class="icon">⊞</span> Ana Sayfa
        </a>
        <a routerLink="/tasks" routerLinkActive="active" class="nav-item">
          <span class="icon">☑</span> Görevler
        </a>
        <a routerLink="/messages" routerLinkActive="active" class="nav-item" style="justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 12px;">
            <span class="icon">💬</span> Mesajlar
          </span>
          <span *ngIf="signalrService.totalUnreadCount() > 0" class="unread-badge">
            {{ signalrService.totalUnreadCount() }}
          </span>
        </a>
        <a routerLink="/members" routerLinkActive="active" class="nav-item">
          <span class="icon">👥</span> Üyeler
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="nav-item">
          <span class="icon">⚙</span> Ayarlar
        </a>
      </nav>

      <div class="recent-activity">
        <h3>Son Aktiviteler</h3>
        <div class="activity-item">
          <div class="dot green"></div>
          <p>Sisteme başarıyla giriş yaptınız.<br><span>Bugün</span></p>
        </div>
      </div>

      <div class="sidebar-bottom">
        <a href="javascript:void(0)" class="nav-item"><span class="icon">ⓘ</span> Yardım & Bilgi</a>
        <a href="javascript:void(0)" (click)="logoutClick.emit()" class="nav-item text-danger">
          <span class="icon">⎋</span> Çıkış Yap
        </a>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  @Output() logoutClick = new EventEmitter<void>();

  constructor(public signalrService: SignalrService) {}
}
