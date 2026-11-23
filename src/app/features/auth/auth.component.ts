import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="logo">
          <div class="logo-icon"></div>
          <h2>TaskTracker<span>+</span></h2>
        </div>
        <p class="auth-subtitle">{{ isLoginMode ? 'Çalışma alanınıza giriş yapın' : 'Yeni bir hesap oluşturun' }}</p>
        
        <div class="auth-form">
          <input type="text" [(ngModel)]="authUsername" placeholder="Kullanıcı Adı" class="input-field" />
          <input *ngIf="!isLoginMode" type="email" [(ngModel)]="authEmail" placeholder="E-posta" class="input-field" />
          <input type="password" [(ngModel)]="authPassword" (keyup.enter)="isLoginMode ? login() : register()" placeholder="Şifre" class="input-field" />
          
          <button (click)="isLoginMode ? login() : register()" class="btn-primary auth-btn">
            {{ isLoginMode ? 'Giriş Yap' : 'Kayıt Ol' }}
          </button>
        </div>

        <p class="auth-switch">
          {{ isLoginMode ? 'Hesabınız yok mu?' : 'Zaten hesabınız var mı?' }}
          <a href="javascript:void(0)" (click)="toggleAuthMode()">
            {{ isLoginMode ? 'Hesap Oluştur' : 'Giriş Yap' }}
          </a>
        </p>
      </div>
    </div>
  `
})
export class AuthComponent {
  isLoginMode = true;
  authUsername = '';
  authPassword = '';
  authEmail = '';

  constructor(public authService: AuthService) {}

  toggleAuthMode() {
    this.isLoginMode = !this.isLoginMode;
    this.authUsername = '';
    this.authPassword = '';
    this.authEmail = '';
  }

  login() {
    const enteredUsername = this.authUsername.trim();
    this.authService.login({ username: enteredUsername, password: this.authPassword }).subscribe({
      next: () => {
        if (!localStorage.getItem('username')) {
          localStorage.setItem('username', enteredUsername);
        }
        this.authUsername = '';
        this.authPassword = '';
      },
      error: () => alert('Giriş başarısız: Bilgilerinizi kontrol edin.')
    });
  }

  register() {
    if (!this.authUsername.trim() || !this.authEmail.trim() || !this.authPassword.trim()) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    this.authService.register({
      username: this.authUsername.trim(),
      email: this.authEmail.trim(),
      password: this.authPassword
    }).subscribe({
      next: () => {
        alert('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
        this.isLoginMode = true;
      },
      error: (err: any) => {
        const errorMsg = err.error?.message || err.error?.Message || 'Bir hata oluştu.';
        alert('Kayıt başarısız: ' + errorMsg);
      }
    });
  }
}
