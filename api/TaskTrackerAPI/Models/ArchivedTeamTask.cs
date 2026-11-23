namespace TaskTrackerAPI.Models;

public class ArchivedTeamTask
{
    public required string Id { get; set; }
    public Guid TeamId { get; set; }
    public required string Title { get; set; }
    public required string Description { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsCompleted { get; set; }
    public int Priority { get; set; }
    public int UserId { get; set; }
    public required string AssignedTo { get; set; }
}
