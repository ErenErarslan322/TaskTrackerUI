import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { TeamService } from '../teams/team.service';
import { SignalrService } from '../../core/realtime/signalr.service';
import { ProfileStatus } from '../teams/member.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content">
      <h2 style="margin-bottom: 20px; color: var(--text-main);">Hesap Ayarları</h2>
      <div class="settings-form">
        <div class="form-group">
          <label>Kullanıcı Adı</label>
          <input type="text" [value]="authService.currentUser()" disabled class="input-field" style="background: #f4f5f7; width: 100%; max-width: 400px;" />
        </div>
        <div class="form-group" style="margin-top: 15px;">
          <label>Profil Durumu</label>
          <select class="input-field" style="width: 100%; max-width: 400px; cursor: pointer;" [ngModel]="teamService.profileStatus()" (ngModelChange)="onStatusChange($event)">
            <option value="Çevrimiçi">🟢 Çevrimiçi</option>
            <option value="Dışarıda">🟡 Dışarıda</option>
            <option value="Çevrimdışı">🔴 Çevrimdışı</option>
          </select>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  constructor(
    public authService: AuthService,
    public teamService: TeamService,
    private signalrService: SignalrService
  ) {}

  onStatusChange(newStatus: ProfileStatus) {
    this.teamService.selectProfileStatus(newStatus);
    this.signalrService.broadcastStatusChange(this.authService.currentUser(), newStatus);
  }
}
