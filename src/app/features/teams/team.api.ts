import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../../core/api-endpoints';
import { Team, TeamMember } from './member.model';

export type ServerTeam = Omit<Team, 'members'> & { members: Omit<TeamMember, 'status'>[] };

export type LegacyTeam = Pick<Team, 'id' | 'name' | 'owner'> & {
  members: Pick<TeamMember, 'name' | 'role'>[];
};

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/teams`;

  list() {
    return this.http.get<ServerTeam[]>(this.url);
  }

  importLegacy(team: LegacyTeam) {
    return this.http.post<void>(`${this.url}/import`, team);
  }

  create(name: string) {
    return this.http.post<{ id: string }>(this.url, { name });
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  invite(id: string, email: string) {
    return this.http.post<void>(`${this.url}/${id}/members`, { email });
  }

  removeMember(id: string, userId: number) {
    return this.http.delete<void>(`${this.url}/${id}/members/${userId}`);
  }

  setAdmin(id: string, userId: number, isAdmin: boolean) {
    return this.http.put<void>(`${this.url}/${id}/members/${userId}/role`, { isAdmin });
  }
}
