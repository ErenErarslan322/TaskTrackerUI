import { Team, TeamMember } from './member.model';

export function isTeamOwner(team: Team | null, username: string): boolean {
  return !!team && team.owner.toLowerCase() === username.toLowerCase();
}

export function canManageTeam(team: Team | null, username: string): boolean {
  if (!team) return false;
  const name = username.toLowerCase();
  return isTeamOwner(team, name) ||
    team.members.some(member => member.name.toLowerCase() === name && member.role === 'Yönetici');
}

export function getAssignableMembers(team: Team, username: string): TeamMember[] {
  if (isTeamOwner(team, username)) return team.members;

  const owner = team.owner.toLowerCase();
  const manager = username.toLowerCase();
  return team.members.filter(member => {
    const name = member.name.toLowerCase();
    return name !== owner && name !== manager;
  });
}
