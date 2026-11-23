import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { TeamService } from './team.service';
import { normalizeSearchText, PageSearchService } from '../../core/search/page-search.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members.component.html'
})
export class MembersComponent {
  newTeamName = '';
  newMemberEmail = '';

  filteredMembers = computed(() => {
    const members = this.teamService.selectedTeam()?.members ?? [];
    const query = this.pageSearch.queryFor('members');
    return query ? members.filter(member =>
      normalizeSearchText(member.name).includes(query) ||
      normalizeSearchText(member.email).includes(query)
    ) : members;
  });

  constructor(
    public authService: AuthService,
    public teamService: TeamService,
    private pageSearch: PageSearchService
  ) {}

  createTeam() {
    this.teamService.createTeam(this.newTeamName, () => {
      this.newTeamName = '';
    });
  }

  inviteMember() {
    this.teamService.inviteMember(this.newMemberEmail, () => {
      this.newMemberEmail = '';
    });
  }

  isCurrentUser(name: string): boolean {
    return name.toLowerCase() === (this.authService.currentUser() || '').trim().toLowerCase();
  }

  isOwnerOf(ownerName: string): boolean {
    return ownerName.toLowerCase() === (this.authService.currentUser() || '').trim().toLowerCase();
  }
}
