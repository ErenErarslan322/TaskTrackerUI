# TaskTrackerUI

## Development server

To start a local development server, run:

```bash
ng serve -o
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Frontend architecture

`src/app/features` keeps each feature's screen, state and API calls together. For example, `features/tasks` holds the task screen and template, its state in `task.service.ts`, its HTTP requests in `task.api.ts`, and the overdue rule in `task-deadline.ts`. Team permission rules live in `features/teams/team-permissions.ts`.

`src/app/core` contains search, the shared SignalR connection, and the API and hub addresses. `src/app/layout` contains the sidebar and top bar. Routes live in `src/app/app.routes.ts`.

When a user adds a task, `TasksComponent` calls `TaskService`. The service builds the payload using the selected scope, calls `TaskApi`, and refreshes the task list after saving. Tests live under `src/tests`, with unit tests grouped by component and service and integration tests grouped by workflow.

## API JWT configuration

The sibling `TaskTrackerAPI` project requires a Base64-encoded JWT signing key that decodes to at least 32 bytes. In PowerShell, run this from the UI project directory to generate and store a development key:

```powershell
$jwtProject = '../TaskTrackerAPI/TaskTrackerAPI/TaskTrackerAPI.csproj'
$jwtBytes = New-Object byte[] 32
$jwtGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $jwtGenerator.GetBytes($jwtBytes)
    @{ 'Jwt:SigningKey' = [Convert]::ToBase64String($jwtBytes) } |
        ConvertTo-Json -Compress |
        dotnet user-secrets set --project $jwtProject
} finally {
    $jwtGenerator.Dispose()
    [Array]::Clear($jwtBytes, 0, $jwtBytes.Length)
}
```

Run the API with `ASPNETCORE_ENVIRONMENT=Development` to load User Secrets. The local Visual Studio launch profiles set this value. For production, inject a separately generated signing key through the hosting platform's secret configuration as `Jwt__SigningKey`. Restart the API after rotating the key. Users must sign in again to receive new tokens.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
