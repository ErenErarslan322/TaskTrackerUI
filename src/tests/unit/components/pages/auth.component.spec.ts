import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthComponent } from '../../../../app/features/auth/auth.component';
import { AuthService } from '../../../../app/features/auth/auth.service';

const authUrl = 'http://localhost:5032/api/auth';

describe('AuthComponent', () => {
  let fixture: ComponentFixture<AuthComponent>;
  let http: HttpTestingController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    fixture = TestBed.createComponent(AuthComponent);
    root = fixture.nativeElement;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    http.verify();
  });

  it('switches the form to registration and requires the email, username and password', () => {
    expect(root.querySelectorAll('.logo .logo-icon[aria-hidden="true"]')).toHaveLength(1);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    root.querySelector<HTMLElement>('.auth-switch a')!.click();
    fixture.detectChanges();
    expect(root.querySelector('input[type=email]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.auth-btn')!.click();
    expect(alert).toHaveBeenCalledWith('Lütfen tüm alanları doldurun.');
    http.expectNone(`${authUrl}/register`);

    Object.assign(fixture.componentInstance, {
      authUsername: '  test-user  ', authEmail: ' test@example.test ', authPassword: 'test-password'
    });
    root.querySelector<HTMLButtonElement>('.auth-btn')!.click();
    const request = http.expectOne({ method: 'POST', url: `${authUrl}/register` });
    expect(request.request.body).toEqual({
      username: 'test-user', email: 'test@example.test', password: 'test-password'
    });
    request.flush({ message: 'OK' });
    fixture.detectChanges();
    expect(root.querySelector('input[type=email]')).toBeNull();
    expect(root.querySelector('.auth-btn')?.textContent).toContain('Giriş Yap');
  });

  it('reports rejected login and starts a session only after a successful retry', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const button = root.querySelector<HTMLButtonElement>('.auth-btn')!;
    fixture.componentInstance.authUsername = '  test-user  ';
    fixture.componentInstance.authPassword = 'test-password';
    button.click();
    http.expectOne(`${authUrl}/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(alert).toHaveBeenCalledWith('Giriş başarısız: Bilgilerinizi kontrol edin.');
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(false);
    expect(fixture.componentInstance.authPassword).toBe('test-password');

    button.click();
    const request = http.expectOne({ method: 'POST', url: `${authUrl}/login` });
    expect(request.request.body).toEqual({ username: 'test-user', password: 'test-password' });
    request.flush({ username: 'test-user', token: 'test-token', userId: 2 });
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(true);
    expect(fixture.componentInstance.authPassword).toBe('');
  });
});
