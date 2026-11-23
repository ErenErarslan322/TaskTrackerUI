using Microsoft.EntityFrameworkCore;
using TaskTrackerAPI.Models;

namespace TaskTrackerAPI.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<TaskItem> Tasks { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<Team> Teams { get; set; }
        public DbSet<TeamMembership> TeamMemberships { get; set; }
        public DbSet<ArchivedTeamTask> ArchivedTeamTasks { get; set; }
        public DbSet<DeletedLegacyTeam> DeletedLegacyTeams { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<DeletedLegacyTeam>().HasKey(item => new { item.OwnerId, item.LegacyId })
                .IsClustered(false);
            modelBuilder.Entity<Team>().HasOne(team => team.Owner).WithMany()
                .HasForeignKey(team => team.OwnerId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<TeamMembership>().HasOne(member => member.User).WithMany()
                .HasForeignKey(member => member.UserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<TaskItem>().HasOne(task => task.Team).WithMany()
                .HasForeignKey(task => task.TeamId).OnDelete(DeleteBehavior.Restrict);
        }

    }
}
