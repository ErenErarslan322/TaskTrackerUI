namespace TaskTrackerAPI.Models
{
    public class TaskItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public bool IsCompleted { get; set; } = false;
        public int Priority { get; set; } = 2;
        public int UserId { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public User? User { get; set; }
        public Guid? TeamId { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public Team? Team { get; set; }
        public string AssignedTo { get; set; } = "Genel";
    }
}