using System.ComponentModel.DataAnnotations;

namespace TaskTrackerAPI.Models;

public class DeletedLegacyTeam
{
    public int OwnerId { get; set; }
    [MaxLength(450)]
    public required string LegacyId { get; set; }
}
