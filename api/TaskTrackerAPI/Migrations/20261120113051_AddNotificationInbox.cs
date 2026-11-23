using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationInbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecipientId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Sender = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ReceivedAt = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_RecipientId",
                        column: x => x.RecipientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_RecipientId",
                table: "Notifications",
                column: "RecipientId");

            migrationBuilder.Sql("""
                INSERT INTO [Notifications] ([Id], [RecipientId], [Kind], [Sender], [Subject], [ReceivedAt])
                SELECT NEWID(), recipient.[Id], N'task-assignment', creator.[Username], task.[Title],
                    DATEDIFF_BIG(MILLISECOND, CAST('1970-01-01' AS datetime2), SYSUTCDATETIME())
                FROM [Tasks] AS task
                INNER JOIN [Users] AS creator ON creator.[Id] = task.[UserId]
                INNER JOIN [Users] AS recipient ON recipient.[Username] = LTRIM(RTRIM(task.[AssignedTo]))
                WHERE task.[Description] LIKE N'TEAM:%' AND task.[IsCompleted] = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");
        }
    }
}
