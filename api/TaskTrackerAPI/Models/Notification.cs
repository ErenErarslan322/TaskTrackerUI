using Microsoft.EntityFrameworkCore;

namespace TaskTrackerAPI.Models;

[Index(nameof(RecipientId))]
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int RecipientId { get; set; }
    public User? Recipient { get; set; }
    public required string Kind { get; set; }
    public required string Sender { get; set; }
    public required string Subject { get; set; }
    public long ReceivedAt { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}
