using Microsoft.EntityFrameworkCore;

namespace TaskTrackerAPI.Models;

[Index(nameof(OwnerId), nameof(LegacyId), IsUnique = true)]
public class Team
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public int OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public string? LegacyId { get; set; }
    public bool IsDeleted { get; set; }
    public List<TeamMembership> Members { get; set; } = [];
}

[PrimaryKey(nameof(TeamId), nameof(UserId))]
public class TeamMembership
{
    public Guid TeamId { get; set; }
    public Team Team { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public bool IsAdmin { get; set; }
}
