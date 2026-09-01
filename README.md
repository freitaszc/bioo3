# BioO3

BioO3 is a full-stack clinic management platform built to automate clinical and administrative workflows.

The platform supports patient management, laboratory analysis, scheduling, inventory, financial workflows, plans, and video-based educational content.

## Features

- Patient and clinic management
- Laboratory report processing and analysis
- Appointment scheduling
- Plans and clinical workflows
- Inventory management
- Cash register and financial workflows
- Video-based educational content
- WhatsApp integration
- Private storage for laboratory documents

## Tech Stack

### Frontend

- React
- Vite
- JavaScript

### Backend

- Node.js
- Express
- Prisma

### Database

- PostgreSQL

### Infrastructure & Integrations

- Docker
- Cloudflare R2
- Mux
- Meta / WhatsApp APIs

### Authentication

- JWT-based authentication
- HTTP-only cookies

## Local Setup

### Requirements

- Node.js 20+
- npm
- Docker Desktop or another Docker Compose-compatible runtime

### 1. Configure the environment

Create the server environment file:

```sh
cp server/.env.example server/.env
```

At minimum, configure:

```env
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Additional environment variables may be required for integrations such as Mux, Cloudflare R2, and WhatsApp.

Do not commit your `.env` file.

### 2. Install dependencies

```sh
npm run install:all
```

### 3. Start the application

```sh
npm run dev
```

This starts the local PostgreSQL database, applies Prisma migrations, seeds the development database, and starts both the API and frontend.

Frontend:

```text
http://localhost:5173
```

API health check:

```text
http://localhost:4000/api/health
```

## Useful Commands

```sh
npm run dev                 # Start the full development environment
npm run dev:server          # Start only the API
npm run dev:client          # Start only the frontend
npm run build:client        # Build the frontend
npm run prisma:generate     # Generate the Prisma client
npm run prisma:deploy       # Apply database migrations
npm run seed                # Seed the development database
npm --prefix server test    # Run server tests
```

## Security

BioO3 may process sensitive patient, clinical, and financial information.

Do not commit real patient data, production database exports, credentials, API keys, private keys, medical documents, or other sensitive information to this repository.

For vulnerability reporting and additional security information, see [SECURITY.md](SECURITY.md).
