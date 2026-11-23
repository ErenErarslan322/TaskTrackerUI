namespace TaskTrackerAPI.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        [System.Text.Json.Serialization.JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;
        [System.Text.Json.Serialization.JsonIgnore]
        public bool PasswordIsHashed { get; set; }

        public List<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}
