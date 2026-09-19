# Render deployment guide

This guide deploys the complete Darukaa.Earth application from the repository's `render.yaml` Blueprint. The Blueprint creates the frontend, API, and PostgreSQL database and enables automatic deployment after GitHub Actions succeeds.

## Before deployment

You need:

- A Render account connected to GitHub
- Access to `Andes-indica/Darukaa`
- A public Mapbox token beginning with `pk.`
- A successful GitHub Actions run on `main`

The repository is public, so reviewer invitations are not required by the hackathon brief.

## Create the Blueprint

1. Sign in to the Render dashboard.
2. Select **New** and then **Blueprint**.
3. Connect the `Andes-indica/Darukaa` repository.
4. Keep the Blueprint path as `render.yaml`.
5. Review the three resources:
   - `darukaa-earth-web`
   - `darukaa-earth-api`
   - `darukaa-earth-database`
6. Provide the prompted environment values:

| Service | Variable            | Value                                                                                         |
| ------- | ------------------- | --------------------------------------------------------------------------------------------- |
| API     | `CORS_ORIGINS`      | The exact public frontend origin, such as `https://darukaa-earth-web.onrender.com`            |
| Web     | `VITE_API_URL`      | The public API origin with `/api/v1`, such as `https://darukaa-earth-api.onrender.com/api/v1` |
| Web     | `VITE_MAPBOX_TOKEN` | Your public Mapbox token beginning with `pk.`                                                 |

7. Apply the Blueprint and wait for all three resources to finish provisioning.

Render generates `JWT_SECRET`. Do not replace it with the development value from `.env.example`.

If Render changes either service name because the desired name is unavailable, update `CORS_ORIGINS` and `VITE_API_URL` with the actual URLs and manually redeploy both services.

## What happens during deployment

The API build installs the locked Python dependencies. Before each new API version goes live, Render runs:

```bash
uv run alembic -c alembic.ini upgrade head
```

Migration `0001` enables PostGIS and pgcrypto before creating application tables and indexes. The API then starts on Render's assigned port and exposes `/api/v1/health` as its health-check path.

The static-site build installs the locked npm dependencies, type-checks the React application, and publishes `apps/web/dist` to Render's CDN.

Both services use `autoDeployTrigger: checksPass`. A push to `main` deploys only after GitHub Actions completes successfully.

## Verify the deployment

Replace the example API URL below with the deployed API origin:

```bash
curl https://darukaa-earth-api.onrender.com/api/v1/health
curl https://darukaa-earth-api.onrender.com/api/v1/health/database
```

Expected results:

```json
{ "status": "ok", "service": "darukaa-api" }
```

```json
{ "status": "ok", "database": "connected", "postgis_version": "..." }
```

Then open the frontend URL and complete this smoke test:

1. Register a new account.
2. Create a project.
3. Open the project map workspace.
4. Draw and save a polygon site.
5. Open the site's analytics panel.
6. Add two observations of the same metric.
7. Confirm the trend chart appears.
8. Sign out and sign back in.

## Troubleshooting

### The API health endpoint works but registration fails

Open the API environment settings and confirm `DATABASE_URL` is linked to `darukaa-earth-database`. Check the API deploy log to confirm the Alembic pre-deploy command completed.

### The browser reports a CORS error

Set `CORS_ORIGINS` to the exact frontend origin without a trailing slash, then redeploy the API.

### The frontend calls localhost

Set `VITE_API_URL` to the public API URL ending in `/api/v1`, then redeploy the static site. Vite embeds this value at build time.

### The map area is blank

Confirm `VITE_MAPBOX_TOKEN` contains a valid public token and redeploy the static site. Also verify that the token's URL restrictions include the Render frontend domain.

### The first request is slow

Free web services can cold-start after inactivity. Wait for the initial request to complete before testing the workflow.

## Submission update

After verification, record the exact frontend URL. It is the **Live Demo URL** required in the final Word submission. The API URL can be included as an additional reviewer link.
