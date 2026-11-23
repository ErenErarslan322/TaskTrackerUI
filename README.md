# TaskTracker UI

Angular frontend for TaskTracker, a workspace where people can organize personal and team tasks, track deadlines, and coordinate in real time.

- Plan work on a task board or calendar and see what's due in the next two days.
- Create teams, assign tasks, and manage access through founder, administrator, and member roles.
- Chat with teammates and get real-time presence and notifications through SignalR.

The [TaskTracker API](https://github.com/ErenErarslan322/TaskTrackerAPI) provides authentication, data storage, and real-time events.

## Run in VS Code

1. Install VS Code and Node.js 24.15 or later in the 24.x line. Clone this repository or download and extract its ZIP.
2. Follow the [API setup guide](https://github.com/ErenErarslan322/TaskTrackerAPI#run-in-visual-studio) to start the backend in Visual Studio using the **http** profile. Leave it running at `http://localhost:5032`.
3. Open the UI folder in VS Code. In the integrated terminal, run:

   ```powershell
   npm ci
   npm start -- --open
   ```

4. Angular opens at `http://localhost:4200`. Create an account to start using the application.

The API and SignalR addresses are defined in [api-endpoints.ts](src/app/core/api-endpoints.ts). Use port `4200` for the UI so the API accepts its requests.

## Source layout

- `src/app/features/` groups screens, templates, state, and HTTP clients by feature.
- `src/app/core/` contains shared search and SignalR services.
- `src/app/layout/` contains the sidebar and top bar.

## Build and test

```powershell
npm run build
npm test -- --watch=false
```

The tests use simulated HTTP and SignalR connections. They run without the backend or SQL Server. See the [test guide](src/tests/README.md) for the suite layout.
