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
[Route("api/tasks")]
[ApiController]
public class TasksController(AppDbContext db, NotificationDelivery delivery) : ControllerBase
{
    private int AccountId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!, CultureInfo.InvariantCulture);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var tasks = await VisibleTasks().AsNoTracking().ToListAsync();
        return Ok(tasks);
    }

    [HttpPost]
    public async Task<IActionResult> Create(TaskWriteRequest request)
    {
        if (Invalid(request)) return BadRequest(new { message = "Görev başlığı ve önceliği geçerli olmalı." });

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        Team? team = null;
        if (request.TeamId is Guid teamId)
        {
            team = await db.Teams.Include(item => item.Members).ThenInclude(member => member.User)
                .SingleOrDefaultAsync(item => item.Id == teamId && !item.IsDeleted &&
                    item.Members.Any(member => member.UserId == AccountId));
            if (team is null) return NotFound();
            if (!CanManage(team)) return Forbid();
        }

        var assignee = team is null ? null : FindAssignee(team, request.AssignedTo);
        if (team is not null && assignee is null)
            return BadRequest(new { message = "Görev yalnızca takımın bir üyesine atanabilir." });

        if (team is not null && assignee is not null && !CanAssignTo(team, assignee))
            return AssignmentForbidden();

        var task = new TaskItem
        {
            Title = request.Title.Trim(),
            Description = CleanDescription(request.Description),
            DueDate = request.DueDate,
            Priority = request.Priority,
            UserId = AccountId,
            TeamId = team?.Id,
            AssignedTo = assignee?.User.Username ?? User.Identity!.Name!
        };
        db.Tasks.Add(task);
        var notification = assignee is null ? null : QueueAssignment(task, assignee.UserId);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await PublishChanges(task, team, notification);
        return Ok(task);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, TaskWriteRequest request)
    {
        if (Invalid(request)) return BadRequest(new { message = "Görev başlığı ve önceliği geçerli olmalı." });

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        var task = await FindVisibleTask(id);
        if (task is null) return NotFound();
        var team = task.Team;
        if (team is not null && !CanManage(team)) return Forbid();
        if (request.TeamId is Guid requestedTeamId && requestedTeamId != task.TeamId) return BadRequest();

        var assignee = team is null ? null : FindAssignee(team, request.AssignedTo ?? task.AssignedTo);
        if (team is not null && assignee is null)
            return BadRequest(new { message = "Görev yalnızca takımın bir üyesine atanabilir." });

        var assigneeChanged = assignee is not null &&
            !string.Equals(assignee.User.Username, task.AssignedTo, StringComparison.OrdinalIgnoreCase);
        if (team is not null && assignee is not null && assigneeChanged && !CanAssignTo(team, assignee))
            return AssignmentForbidden();

        task.Title = request.Title.Trim();
        task.Description = CleanDescription(request.Description);
        task.DueDate = request.DueDate;
        task.Priority = request.Priority;
        task.AssignedTo = assignee?.User.Username ?? User.Identity!.Name!;
        if (request.IsCompleted is bool completed) task.IsCompleted = completed;

        var notification = assigneeChanged ? QueueAssignment(task, assignee!.UserId) : null;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await PublishChanges(task, team, notification);
        return NoContent();
    }

    [HttpPatch("{id}/completion")]
    public async Task<IActionResult> SetCompletion(string id, CompletionRequest request)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        var task = await FindVisibleTask(id);
        if (task is null) return NotFound();
        var team = task.Team;
        if (team is not null && !CanManage(team) &&
            !string.Equals(task.AssignedTo, User.Identity?.Name, StringComparison.OrdinalIgnoreCase)) return Forbid();

        task.IsCompleted = request.IsCompleted;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await PublishChanges(task, team);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        var task = await FindVisibleTask(id);
        if (task is null) return NotFound();
        var team = task.Team;
        if (team is not null && !CanManage(team)) return Forbid();

        db.Tasks.Remove(task);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        await PublishChanges(task, team);
        return NoContent();
    }

    private IQueryable<TaskItem> VisibleTasks() => db.Tasks.Where(task =>
        (task.TeamId == null && task.UserId == AccountId && !task.Description.StartsWith("TEAM:")) ||
        (task.TeamId != null && !task.Team!.IsDeleted && task.Team.Members.Any(member => member.UserId == AccountId)));

    private Task<TaskItem?> FindVisibleTask(string id) => VisibleTasks()
        .Include(task => task.Team).ThenInclude(team => team!.Members).ThenInclude(member => member.User)
        .SingleOrDefaultAsync(task => task.Id == id);

    private bool CanManage(Team team) =>
        team.OwnerId == AccountId || team.Members.Any(member => member.UserId == AccountId && member.IsAdmin);

    private bool CanAssignTo(Team team, TeamMembership assignee) =>
        team.OwnerId == AccountId || (assignee.UserId != team.OwnerId && assignee.UserId != AccountId);

    private ObjectResult AssignmentForbidden() => StatusCode(StatusCodes.Status403Forbidden,
        new { message = "Yöneticiler görevleri yalnızca diğer yöneticilere ve takım üyelerine atayabilir." });

    private TeamMembership? FindAssignee(Team team, string? username) => string.IsNullOrWhiteSpace(username)
        ? team.Members.Single(member => member.UserId == AccountId)
        : team.Members.SingleOrDefault(member =>
            string.Equals(member.User.Username, username.Trim(), StringComparison.OrdinalIgnoreCase));

    private static bool Invalid(TaskWriteRequest request) =>
        string.IsNullOrWhiteSpace(request.Title) || request.Priority is < 1 or > 3;

    private static string CleanDescription(string? description) =>
        description?.StartsWith("TEAM:", StringComparison.OrdinalIgnoreCase) == true ? "" : description?.Trim() ?? "";

    private Notification QueueAssignment(TaskItem task, int assigneeId)
    {
        var notification = new Notification
        {
            RecipientId = assigneeId,
            Kind = "task-assignment",
            Subject = task.Title,
            Sender = User.Identity!.Name!
        };
        db.Notifications.Add(notification);
        return notification;
    }

    private async Task PublishChanges(TaskItem task, Team? team, Notification? notification = null)
    {
        if (notification is not null) await delivery.PublishAsync(notification);
        await delivery.RefreshWorkspaceAsync(team?.Members.Select(member => member.UserId) ?? [task.UserId]);
    }

    public record TaskWriteRequest(string Title, string? Description, DateTime? DueDate, int Priority,
        Guid? TeamId, string? AssignedTo, bool? IsCompleted = null);

    public record CompletionRequest(bool IsCompleted);
}
