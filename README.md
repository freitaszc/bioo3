# BioO3

BioO3 is a work-in-progress full-stack application for clinic operations, patient records, laboratory analysis, inventory, plans, scheduling, cash register workflows, and video-based educational content.

The application handles sensitive clinical, personal, and financial information. Treat this repository as source code only: never add real patient data, production database exports, uploaded reports, credentials, or private keys.

## Status

This project is under active development and should not be assumed to be production-ready. Review the security, privacy, deployment, and regulatory requirements for your environment before using it with real data.

The repository currently has no open-source license. Until a `LICENSE` file is added, do not assume that the code, branding, or bundled documents may be reused or redistributed.

## Stack

- React and Vite client
- Node.js and Express API
- PostgreSQL with Prisma migrations
- JWT sessions stored in HTTP-only cookies
- Docker Compose for local PostgreSQL

## Repository layout

```text
client/                 React/Vite frontend
server/                 Express API, Prisma schema, migrations, and tests
server/prisma/          Database schema, migrations, and seed data
server/src/              API routes and services
docker-compose.yml       Local PostgreSQL service
scripts/dev.js           Local development orchestration
Plan.md                 Functional plan and roadmap
```

## Prerequisites

- Node.js current LTS (Node 20 or newer is recommended)
- npm
- Docker Desktop or another Docker Compose-compatible runtime

## Local setup

1. Create the local server environment file:

   ```sh
   cp server/.env.example server/.env
   ```

2. Edit `server/.env`. At minimum, set a unique local `JWT_SECRET`, `ADMIN_EMAIL`, and strong `ADMIN_PASSWORD`.

3. Install dependencies:

   ```sh
   npm run install:all
   ```

4. Start PostgreSQL, apply migrations, seed the development database, and start the client and API:

   ```sh
   npm run dev
   ```

   The frontend is available at `http://localhost:5173` and the API health check is available at `http://localhost:4000/api/health`.

The development script starts the local PostgreSQL container and runs Prisma setup and seeding automatically. To stop the database without removing its local volume:

```sh
docker compose stop postgres
```

To remove the local database volume, first confirm that it contains no data you need, then run:

```sh
docker compose down -v
```

### Seeding and legacy data

`server/prisma/seed.js` seeds the administrator, videos, and other development records. If a sibling legacy `Web/` directory exists, it may also read JSON files containing doctors, patients, consultations, and products from that directory.

Do not run the seed command against a production database. Before running it locally, verify that any legacy JSON files contain only synthetic or authorized data.

## Environment variables

The server reads environment variables from `server/.env`. Never commit that file.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Long, random session-signing secret |
| `ADMIN_EMAIL` | Yes for seeding | Initial administrator email |
| `ADMIN_PASSWORD` | Yes for seeding | Initial administrator password |
| `ADMIN_USERNAME` | No | Initial administrator username; defaults to `admin` |
| `PORT` | No | API port; defaults to `4000` |
| `HOST` | No | API bind host; defaults to `0.0.0.0` |
| `CLIENT_ORIGIN` | No | Comma-separated allowed browser origins |
| `MUX_SIGNING_KEY` | No | Mux signed-playback key ID |
| `MUX_PRIVATE_KEY` | No | Mux private signing key; keep it secret |
| `FISCAL_PROVIDER` | No | Fiscal provider identifier, when configured |
| `R2_ACCOUNT_ID` / `R2_ENDPOINT` | Yes in production | Cloudflare R2 account endpoint for private laboratory documents |
| `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Yes in production | Private R2 bucket and credentials |
| `META_APP_ID` / `META_APP_SECRET` | For WhatsApp | Meta application used by Embedded Signup and webhook verification |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | For WhatsApp | Coexistence Embedded Signup configuration |
| `META_WEBHOOK_VERIFY_TOKEN` | For WhatsApp | Secret used for the Meta webhook challenge |
| `WHATSAPP_TOKEN_ENCRYPTION_KEY` | For WhatsApp | At least 32 random characters used to encrypt the connected access token |
| `WHATSAPP_REPORT_TEMPLATE` | No | Approved utility template; defaults to `bioo3_relatorio_exames_v1` |

The client optionally accepts `VITE_API_URL` in `client/.env`; it defaults to `/api`.

## Useful commands

```sh
npm run dev                 # Start PostgreSQL, seed, API, and client
npm run dev:server          # Start only the API
npm run dev:client          # Start only the frontend
npm run build:client        # Build the frontend
npm run prisma:generate     # Generate the Prisma client
npm run prisma:deploy       # Apply committed migrations
npm run seed                # Seed the configured database
npm --prefix server test    # Run server tests
```

The root `build` script applies database migrations before building the client. Use it only with an intentionally selected database and environment.

## Production considerations

- Use a managed or separately secured PostgreSQL instance; do not expose the development database configuration to the internet.
- Replace every development credential with a unique secret stored in the deployment platform's secret manager.
- Serve the application over HTTPS and set `NODE_ENV=production` so session cookies use the `secure` attribute.
- Set `CLIENT_ORIGIN` to the exact production frontend origin rather than relying on local defaults.
- Keep database backups, uploads, generated reports, logs, and patient records outside Git and outside publicly readable storage.
- Add monitoring, rate limiting, security headers, dependency scanning, backup protection, and an incident-response process before handling real data.
- Have qualified legal, privacy, and clinical stakeholders review the deployment for applicable requirements.

## Security

Please read [SECURITY.md](SECURITY.md) before reporting or investigating a vulnerability. Do not open a public issue containing credentials, private keys, patient information, medical reports, or other sensitive data.
