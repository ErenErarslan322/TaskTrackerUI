using System.Globalization;
using Microsoft.AspNetCore.SignalR;
using TaskTrackerAPI.Models;

namespace TaskTrackerAPI.Hubs;

public record NotificationPayload(Guid Id, string Kind, string Sender, string Subject, long ReceivedAt);

public class NotificationDelivery(IHubContext<AppHub> hub, ILogger<NotificationDelivery> logger)
{
    public async Task RefreshWorkspaceAsync(IEnumerable<int> accounts)
    {
        var recipients = accounts.Distinct().Select(id => id.ToString(CultureInfo.InvariantCulture)).ToArray();
        try
        {
            await hub.Clients.Users(recipients).SendAsync("WorkspaceChanged");
        }
        catch (Exception error)
        {
            logger.LogWarning(error, "Could not notify clients to refresh their workspace");
        }
    }

    public async Task PublishAsync(Notification notification)
    {
        try
        {
            await hub.Clients.User(notification.RecipientId.ToString(CultureInfo.InvariantCulture))
                .SendAsync("ReceiveNotification", new NotificationPayload(notification.Id, notification.Kind,
                    notification.Sender, notification.Subject, notification.ReceivedAt));
        }
        catch (Exception error)
        {
            logger.LogWarning(error, "Could not deliver notification {NotificationId} in real time", notification.Id);
        }
    }
}
