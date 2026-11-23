import { Injectable, inject, signal, computed } from '@angular/core';
import { ServerTeam, TeamApi } from './team.api';
import { catchError, concatMap, from, Observable, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Team, TeamMember, ProfileStatus } from './member.model';
import { canManageTeam, isTeamOwner } from './team-permissions';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly api = inject(TeamApi);
  private readonly legacyTeamsKey = 'taskTracker_allTeams';
  private readonly teams = signal<ServerTeam[]>([]);
  private readonly presence = signal<Record<string, ProfileStatus>>({});
  private requestVersion = 0;

  readonly profileStatus = signal<ProfileStatus>('Çevrimiçi');
  readonly selectedTeamId = signal('');
  readonly teamIds = computed(() => this.teams().map(team => team.id));

  readonly myTeams = computed<Team[]>(() => {
    const presence = this.presence();
    return this.teams().map(team => ({
      ...team,
      members: team.members.map(member => ({
        ...member,
        status: presence[member.name.toLowerCase()] ?? 'Çevrimdışı'
      }))
    }));
  });

  readonly selectedTeam = computed(() => {
    const teams = this.myTeams();
    return teams.find(team => team.id === this.selectedTeamId()) ?? teams[0] ?? null;
  });

  readonly isSelectedTeamOwner = computed(() => this.isOwner(this.selectedTeam()));
  readonly canManageSelectedTeam = computed(() => this.canManage(this.selectedTeam()));

  readonly otherMembers = computed(() => {
    const currentUser = this.currentUsername();
    const members = new Map<string, TeamMember>();
    for (const team of this.myTeams()) {
      for (const member of team.members) {
        const name = member.name.toLowerCase();
        if (name !== currentUser && !members.has(name)) members.set(name, member);
      }
    }
    return [...members.values()];
  });

  constructor(private authService: AuthService) {}

  private currentUsername(): string {
    return this.authService.currentUser().trim().toLowerCase();
  }

  private isOwner(team: Team | null): boolean {
    return isTeamOwner(team, this.currentUsername());
  }

  canManage(team: Team | null): boolean {
    return canManageTeam(team, this.currentUsername());
  }

  loadTeams() {
    const user = this.authService.currentUser();
    if (!user) return;

    const version = ++this.requestVersion;
    this.api.list().subscribe({
      next: teams => {
        if (version !== this.requestVersion || user !== this.authService.currentUser()) return;
        this.teams.set(teams);
        if (!teams.some(team => team.id === this.selectedTeamId())) {
          this.selectedTeamId.set(teams[0]?.id ?? '');
        }
      },
      error: err => console.error('Takımlar yüklenemedi:', err)
    });
  }

  importLegacyTeams(afterImport: () => void) {
    const user = this.currentUsername();
    const token = localStorage.getItem('token');
    let teams: Team[];
    try {
      const saved: Team[] = JSON.parse(localStorage.getItem(this.legacyTeamsKey) ?? '[]');
      teams = saved.filter(team => team.id.startsWith('team_') &&
        (team.owner.toLowerCase() === user ||
          (team.members ?? []).some(member => member.name.toLowerCase() === user)));
    } catch {
      teams = [];
    }
    if (!teams.length) return;

    from(teams).pipe(concatMap(team => {
      if (this.currentUsername() !== user || localStorage.getItem('token') !== token) return of(undefined);
      const { id, name, owner, members } = team;
      return this.api.importLegacy({
        id, name, owner,
        members: (members ?? []).map(member => ({ name: member.name, role: member.role ?? 'Takım Üyesi' }))
      }).pipe(catchError(error => {
        console.error('Eski takım aktarılamadı:', error);
        return of(undefined);
      }));
    })).subscribe({
      complete: () => {
        if (this.currentUsername() === user && localStorage.getItem('token') === token) afterImport();
      }
    });
  }

  clearState() {
    this.requestVersion++;
    this.teams.set([]);
    this.selectedTeamId.set('');
    this.presence.set({});
  }

  selectTeam(teamId: string) {
    this.selectedTeamId.set(teamId);
  }

  createTeam(teamName: string, onSuccess: () => void) {
    const name = teamName.trim();
    if (!name) {
      window.alert('Lütfen geçerli bir takım adı girin.');
      return;
    }

    const user = this.authService.currentUser();
    this.api.create(name).subscribe({
      next: team => {
        if (user !== this.authService.currentUser()) return;
        this.selectTeam(team.id);
        this.loadTeams();
        onSuccess();
      },
      error: err => this.showError(err, 'Takım oluşturulamadı.')
    });
  }

  deleteTeam(teamId: string) {
    const team = this.myTeams().find(item => item.id === teamId);
    if (!team || !this.isOwner(team) || !window.confirm(`"${team.name}" takımını silmek istediğinize emin misiniz?`)) return;
    this.applyChange(this.api.delete(team.id), 'Takım silinemedi.');
  }

  leaveTeam(teamId: string) {
    const team = this.myTeams().find(item => item.id === teamId);
    const member = team?.members.find(item => item.name.toLowerCase() === this.currentUsername());
    if (!team || !member || this.isOwner(team) || !window.confirm(`"${team.name}" takımından ayrılmak istediğinize emin misiniz?`)) return;
    this.applyChange(this.api.removeMember(team.id, member.id), 'Takımdan ayrılamadınız.');
  }

  inviteMember(email: string, onSuccess?: () => void) {
    const team = this.selectedTeam();
    if (!team || !this.canManageSelectedTeam()) return;
    if (!email.trim()) {
      window.alert('Lütfen bir e-posta adresi girin.');
      return;
    }

    this.applyChange(this.api.invite(team.id, email.trim()),
      'Üye eklenemedi.', onSuccess);
  }

  removeMember(memberName: string) {
    const team = this.selectedTeam();
    const member = team?.members.find(item => item.name.toLowerCase() === memberName.toLowerCase());
    if (!team || !member || !this.isOwner(team) || member.role === 'Kurucu') return;

    this.applyChange(this.api.removeMember(team.id, member.id), 'Üye çıkarılamadı.');
  }

  toggleAdminRole(memberName: string) {
    const team = this.selectedTeam();
    const member = team?.members.find(item => item.name.toLowerCase() === memberName.toLowerCase());
    if (!team || !member || !this.isOwner(team) || member.role === 'Kurucu') return;

    this.applyChange(this.api.setAdmin(team.id, member.id, member.role !== 'Yönetici'), 'Üye yetkisi değiştirilemedi.');
  }

  private applyChange(request: Observable<void>, fallback: string, onSuccess?: () => void) {
    const user = this.authService.currentUser();
    request.subscribe({
      next: () => {
        if (user !== this.authService.currentUser()) return;
        this.loadTeams();
        onSuccess?.();
      },
      error: err => this.showError(err, fallback)
    });
  }

  private showError(error: { status?: number; error?: { message?: string } }, fallback: string) {
    window.alert(error.error?.message ?? (error.status === 403 ? 'Bu işlem için yetkiniz yok.' : fallback));
  }

  getPreferredStatus(): ProfileStatus {
    return localStorage.getItem(`preferredStatus_${this.currentUsername()}`) === 'Dışarıda' ? 'Dışarıda' : 'Çevrimiçi';
  }

  selectProfileStatus(status: ProfileStatus) {
    const user = this.currentUsername();
    if (user && status === 'Dışarıda') {
      localStorage.setItem(`preferredStatus_${user}`, status);
    } else if (status === 'Çevrimiçi') {
      this.clearPreferredStatus();
    }
    this.changeStatus(status);
  }

  clearPreferredStatus() {
    const user = this.currentUsername();
    if (user) localStorage.removeItem(`preferredStatus_${user}`);
  }

  changeStatus(status: ProfileStatus) {
    this.profileStatus.set(status);
    const user = this.currentUsername();
    if (user) {
      this.presence.update(presence => ({ ...presence, [user]: status }));
    }
  }

  updateMemberStatusFromHub(username: string, status: ProfileStatus) {
    const target = username.trim().toLowerCase();
    const isCurrentUser = target === this.currentUsername();
    if (isCurrentUser && status === 'Çevrimiçi' && this.getPreferredStatus() === 'Dışarıda') return;

    this.presence.update(presence => ({ ...presence, [target]: status }));
    if (isCurrentUser) this.profileStatus.set(status);
  }

  getStatusColor(status: string): string {
    if (status === 'Çevrimiçi') return 'var(--green)';
    if (status === 'Çevrimdışı') return 'var(--pink)';
    if (status === 'Dışarıda') return 'var(--orange)';
    return 'var(--text-muted)';
  }
}
