using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class PermanentlyDeleteTeams : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ArchivedTeamTasks",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TeamId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsCompleted = table.Column<bool>(type: "bit", nullable: false),
                    Priority = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    AssignedTo = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArchivedTeamTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeletedLegacyTeams",
                columns: table => new
                {
                    OwnerId = table.Column<int>(type: "int", nullable: false),
                    LegacyId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeletedLegacyTeams", x => new { x.OwnerId, x.LegacyId })
                        .Annotation("SqlServer:Clustered", false);
                });

            migrationBuilder.Sql("""
                INSERT INTO [DeletedLegacyTeams] ([OwnerId], [LegacyId])
                SELECT [OwnerId], [LegacyId]
                FROM [Teams]
                WHERE [IsDeleted] = 1 AND [LegacyId] IS NOT NULL;

                INSERT INTO [ArchivedTeamTasks] ([Id], [TeamId], [Title], [Description], [DueDate],
                    [IsCompleted], [Priority], [UserId], [AssignedTo])
                SELECT task.[Id], task.[TeamId], task.[Title], task.[Description], task.[DueDate],
                    task.[IsCompleted], task.[Priority], task.[UserId], task.[AssignedTo]
                FROM [Tasks] AS task INNER JOIN [Teams] AS team ON team.[Id] = task.[TeamId]
                WHERE team.[IsDeleted] = 1;

                DELETE task
                FROM [Tasks] AS task INNER JOIN [Teams] AS team ON team.[Id] = task.[TeamId]
                WHERE team.[IsDeleted] = 1;

                DELETE FROM [Teams] WHERE [IsDeleted] = 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("A deleted team cannot be restored by rolling back the database schema.");
        }
    }
}
