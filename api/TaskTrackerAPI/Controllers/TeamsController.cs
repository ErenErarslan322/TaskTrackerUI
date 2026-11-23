using System.Data;
using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskTrackerAPI.Data;
using TaskTrackerAPI.Hubs;
using TaskTrackerAPI.Models;

namespace TaskTrackerAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/teams")]
public class TeamsController(AppDbContext db, NotificationDelivery delivery) : ControllerBase
{
    private int AccountId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!, CultureInfo.InvariantCulture);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var teams = await db.Teams.AsNoTracking()
            .Where(team => !team.IsDeleted && team.Members.Any(member => member.UserId == AccountId))
            .OrderBy(team => team.Name)
            .Select(team => new TeamDto(team.Id, team.Name, team.Owner.Username, team.Members
                .OrderBy(member => member.UserId == team.OwnerId ? 0 : member.IsAdmin ? 1 : 2)
                .ThenBy(member => member.User.Username)
                .Select(member => new TeamMemberDto(member.UserId, member.User.Username, member.User.Email,
                    member.UserId == team.OwnerId ? "Kurucu" : member.IsAdmin ? "Yönetici" : "Takım Üyesi"))
                .ToList()))
            .ToListAsync();
        return Ok(teams);
    }

    [HttpPost]
    public async Task<IActionResult> Create(TeamRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Takım adı zorunludur." });

        var team = new Team { Name = request.Name.Trim(), OwnerId = AccountId, Members = [new() { UserId = AccountId }] };
        db.Teams.Add(team);
        await db.SaveChangesAsync();
        await delivery.RefreshWorkspaceAsync([AccountId]);
        return Ok(new { team.Id });
    }

    [HttpPost("import")]
    public async Task<IActionResult> Import(LegacyTeamRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Id) || !request.Id.StartsWith("team_", StringComparison.Ordinal) ||
            !long.TryParse(request.Id.AsSpan(5), NumberStyles.None, CultureInfo.InvariantCulture, out _) ||
            string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Owner))
        {
            return BadRequest(new { message = "Eski takım bilgisi geçersiz." });
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var owner = await db.Users.SingleOrDefaultAsync(user => user.Username == request.Owner);
        if (owner is null) return NoContent();

        var team = await db.Teams.Include(team => team.Members)
            .SingleOrDefaultAsync(team => team.OwnerId == owner.Id && team.LegacyId == request.Id);
        var created = team is null;
        if (created)
        {
            if (owner.Id != AccountId || await db.DeletedLegacyTeams.AnyAsync(item =>
                    item.OwnerId == owner.Id && item.LegacyId == request.Id)) return NoContent();

            team = new Team
            {
                Name = request.Name.Trim(),
                OwnerId = AccountId,
                LegacyId = request.Id,
                Members = [new() { UserId = AccountId }]
            };
            var roles = (request.Members ?? [])
                .Where(member => !string.IsNullOrWhiteSpace(member.Name))
                .GroupBy(member => member.Name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.First().Role, StringComparer.OrdinalIgnoreCase);
            var names = roles.Keys.ToArray();
            var users = await db.Users.Where(user => user.Id != AccountId && names.Contains(user.Username)).ToListAsync();
            team.Members.AddRange(users.Select(user => new TeamMembership
            {
                UserId = user.Id,
                IsAdmin = roles.TryGetValue(user.Username, out var role) && role == "Yönetici"
            }));
            db.Teams.Add(team);
            await db.SaveChangesAsync();
        }

        if (team!.IsDeleted || !team.Members.Any(member => member.UserId == AccountId)) return NoContent();

        // A legacy browser record can associate only tasks already owned by the signed-in account.
        var changed = await db.Tasks.Where(task => task.TeamId == null && task.UserId == AccountId &&
            task.Description == "TEAM:" + request.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(task => task.TeamId, team.Id));
        await transaction.CommitAsync();

        if (created || changed > 0) await delivery.RefreshWorkspaceAsync(team.Members.Select(member => member.UserId));
        return NoContent();
    }

    [HttpPost("{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, AddMemberRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email)) return BadRequest(new { message = "E-posta adresi zorunludur." });

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var team = await FindMyTeam(id);
        if (team is null) return NotFound();
        if (!CanManage(team)) return Forbid();

        var email = request.Email.Trim();
        var member = await db.Users.SingleOrDefaultAsync(user => user.Email == email);
        if (member is null) return NotFound(new { message = "Bu e-posta adresine sahip kullanıcı bulunamadı." });
        if (team.Members.Any(item => item.UserId == member.Id))
            return Conflict(new { message = "Bu kullanıcı zaten takımda." });

        team.Members.Add(new TeamMembership { UserId = member.Id });
        var notification = QueueMembershipNotice(team, member.Id, "team-invitation");
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await delivery.PublishAsync(notification);
        await delivery.RefreshWorkspaceAsync(team.Members.Select(item => item.UserId));
        return NoContent();
    }

    [HttpPut("{id:guid}/members/{userId:int}/role")]
    public async Task<IActionResult> SetRole(Guid id, int userId, RoleRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        var team = await FindMyTeam(id);
        if (team is null) return NotFound();
        if (team.OwnerId != AccountId || userId == team.OwnerId) return Forbid();

        var membership = team.Members.SingleOrDefault(member => member.UserId == userId);
        if (membership is null) return NotFound();

        membership.IsAdmin = request.IsAdmin;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await delivery.RefreshWorkspaceAsync(team.Members.Select(member => member.UserId));
        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{userId:int}")]
    public async Task<IActionResult> RemoveMember(Guid id, int userId)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        var team = await FindMyTeam(id);
        if (team is null) return NotFound();

        var leaving = AccountId == userId;
        if (userId == team.OwnerId || (!leaving && team.OwnerId != AccountId)) return Forbid();

        var membership = team.Members.SingleOrDefault(member => member.UserId == userId);
        if (membership is null) return NotFound();
        var affectedUsers = team.Members.Select(member => member.UserId).ToArray();
        db.TeamMemberships.Remove(membership);
        var notification = leaving ? null : QueueMembershipNotice(team, userId, "team-removal");

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        if (notification is not null) await delivery.PublishAsync(notification);
        await delivery.RefreshWorkspaceAsync(affectedUsers);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var team = await FindMyTeam(id);
        if (team is null) return NotFound();
        if (team.OwnerId != AccountId) return Forbid();

        var affectedUsers = team.Members.Select(member => member.UserId).ToArray();
        if (team.LegacyId is not null)
        {
            db.DeletedLegacyTeams.Add(new DeletedLegacyTeam { OwnerId = team.OwnerId, LegacyId = team.LegacyId });
        }

        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO [ArchivedTeamTasks] ([Id], [TeamId], [Title], [Description], [DueDate],
                [IsCompleted], [Priority], [UserId], [AssignedTo])
            SELECT [Id], [TeamId], [Title], [Description], [DueDate],
                [IsCompleted], [Priority], [UserId], [AssignedTo]
            FROM [Tasks]
            WHERE [TeamId] = {id};
            """);
        await db.Tasks.Where(task => task.TeamId == id).ExecuteDeleteAsync();
        db.Teams.Remove(team);

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await delivery.RefreshWorkspaceAsync(affectedUsers);
        return NoContent();
    }

    private Task<Team?> FindMyTeam(Guid id) =>
        db.Teams.Include(team => team.Members).SingleOrDefaultAsync(team =>
            team.Id == id && !team.IsDeleted && team.Members.Any(member => member.UserId == AccountId));

    private bool CanManage(Team team) =>
        team.OwnerId == AccountId || team.Members.Any(member => member.UserId == AccountId && member.IsAdmin);

    private Notification QueueMembershipNotice(Team team, int userId, string kind)
    {
        var notification = new Notification
        {
            RecipientId = userId,
            Kind = kind,
            Sender = User.Identity!.Name!,
            Subject = team.Name
        };
        db.Notifications.Add(notification);
        return notification;
    }

    public record TeamRequest(string Name);
    public record AddMemberRequest(string Email);
    public record RoleRequest(bool IsAdmin);
    public record LegacyTeamRequest(string Id, string Name, string Owner, LegacyMember[]? Members);
    public record LegacyMember(string Name, string Role);
    public record TeamDto(Guid Id, string Name, string Owner, List<TeamMemberDto> Members);
    public record TeamMemberDto(int Id, string Name, string Email, string Role);
}
