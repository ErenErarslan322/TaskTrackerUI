using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TaskTrackerAPI.Data;
using TaskTrackerAPI.Hubs;

namespace TaskTrackerAPI.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController(AppDbContext context) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        if (!TryGetRecipientId(out var recipientId)) return Unauthorized();

        var items = await context.Notifications
            .Where(item => item.RecipientId == recipientId)
            .OrderByDescending(item => item.ReceivedAt)
            .Select(item => new NotificationPayload(item.Id, item.Kind, item.Sender, item.Subject, item.ReceivedAt))
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost("dismiss")]
    public async Task<IActionResult> DismissNotifications([FromBody] Guid[] ids)
    {
        if (!TryGetRecipientId(out var recipientId)) return Unauthorized();

        await context.Notifications
            .Where(item => item.RecipientId == recipientId && ids.Contains(item.Id))
            .ExecuteDeleteAsync();
        return NoContent();
    }

    private bool TryGetRecipientId(out int id) =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out id);
}
