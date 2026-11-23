# TaskTracker

TaskTracker is a workspace for managing personal and team tasks. It includes task boards and calendars, team roles, real-time messaging, presence, and notifications.

- The Angular frontend lives in `src/`.
- The ASP.NET Core API, Entity Framework Core migrations, and Visual Studio solution live in `api/`.
- The API uses SQL Server and SignalR. Frontend tests live in `src/tests/`.

## Run locally

Install the .NET 10 SDK, SQL Server or SQL Server LocalDB, and Node.js 24.15 or later in the 24.x line. The commands below use PowerShell from the repository root.

### 1. Configure and start the API

The example uses SQL Server LocalDB with Windows authentication. For another SQL Server instance, set `$connection` to your own connection string. User Secrets keeps the database connection and signing key outside the repository.

```powershell
$apiProject = './api/TaskTrackerAPI/TaskTrackerAPI.csproj'
$connection = 'Server=(localdb)\MSSQLLocalDB;Database=TaskTracker;Trusted_Connection=True;TrustServerCertificate=True'
dotnet user-secrets set --project $apiProject 'ConnectionStrings:DefaultConnection' $connection

$keyBytes = New-Object byte[] 32
$keyGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $keyGenerator.GetBytes($keyBytes)
    @{ 'Jwt:SigningKey' = [Convert]::ToBase64String($keyBytes) } |
        ConvertTo-Json -Compress |
        dotnet user-secrets set --project $apiProject
} finally {
    $keyGenerator.Dispose()
    [Array]::Clear($keyBytes, 0, $keyBytes.Length)
}
```

Install the Entity Framework Core CLI if it is missing, then apply the migrations and start the API.

```powershell
dotnet tool install --global dotnet-ef --version 10.0.0
dotnet ef database update --project $apiProject -- --environment Development
dotnet run --project $apiProject --launch-profile http
```

The API listens at `http://localhost:5032`.

### 2. Start the frontend

Open a second terminal at the repository root.

```powershell
npm ci
npm start
```

Open `http://localhost:4200` and create an account.

## Frontend architecture

`src/app/features` keeps each feature's screen, state and API calls together. For example, `features/tasks` holds the task screen and template, its state in `task.service.ts`, its HTTP requests in `task.api.ts`, and the overdue rule in `task-deadline.ts`. Team permission rules live in `features/teams/team-permissions.ts`.

`src/app/core` contains search, the shared SignalR connection, and the API and hub addresses. `src/app/layout` contains the sidebar and top bar. Routes live in `src/app/app.routes.ts`.

When a user adds a task, `TasksComponent` calls `TaskService`. The service builds the payload using the selected scope, calls `TaskApi`, and refreshes the task list after saving.

## Build and test

```powershell
dotnet build ./api/TaskTrackerAPI.slnx
npm run build
npm test -- --watch=false
```

The frontend tests use simulated HTTP and SignalR connections, so they can run without starting the API or SQL Server. See [the test guide](src/tests/README.md) for the suite layout.
