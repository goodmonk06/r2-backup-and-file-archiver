# R2 Backup & File Archiver - Project Structure

## Overview
Production-ready backup service for Cloudflare R2 with web UI, REST API, and CLI.

## Directory Structure

```
r2-backup-and-file-archiver/
├── src/
│   ├── api/                      # HTTP API Layer
│   │   ├── app.ts               # Express application setup
│   │   ├── controllers/         # Request handlers
│   │   │   └── job.controller.ts
│   │   ├── middleware/          # API middleware
│   │   │   ├── errorHandler.ts # Centralized error handling
│   │   │   └── validate.ts     # Zod validation middleware
│   │   └── routes/              # Route definitions
│   │       └── job.routes.ts
│   ├── backup/                   # Core backup logic
│   │   ├── backupRunner.ts      # Orchestrates backup execution
│   │   ├── fileScanner.ts       # File scanning & hashing
│   │   └── fileScanner.test.ts  # Tests
│   ├── config/                   # Configuration
│   │   ├── env.ts               # Environment variables
│   │   └── r2Client.ts          # R2/S3 client setup
│   ├── config-loader/            # YAML config loading
│   │   └── backupConfigLoader.ts
│   ├── db/                       # Database
│   │   └── prisma.ts            # Prisma client singleton
│   ├── repositories/             # Data access layer
│   │   └── job.repository.ts
│   ├── scheduler/                # Cron scheduling
│   │   └── index.ts
│   ├── services/                 # Business logic
│   │   └── job.service.ts
│   ├── validators/               # Schema validation
│   │   ├── job.schema.ts
│   │   └── job.schema.test.ts
│   ├── cli.ts                   # CLI entry point
│   └── server.ts                # HTTP server entry point
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── seed.ts                  # Demo data seeder
│   └── migrations/              # Database migrations
├── public/
│   └── index.html               # Web UI (SPA)
├── config/
│   └── backup.example.yml       # Example job configuration
├── Dockerfile                   # Container definition
├── docker-compose.yml           # Multi-container setup
├── vitest.config.ts            # Test configuration
├── eslint.config.js            # Linter configuration
└── package.json                # Dependencies & scripts

## Key Components

### 1. API Layer (Express + Zod)
- **Controllers**: Handle HTTP requests/responses
- **Middleware**: Validation, error handling, CORS
- **Routes**: REST endpoints for jobs

### 2. Service Layer
- **JobService**: Business logic for job operations
- Integrates with BackupRunner for execution
- Manages database operations via repositories

### 3. Data Layer (Prisma + PostgreSQL)
- **Models**: BackupJob, BackupHistory
- **Repositories**: Abstraction over Prisma operations
- **Migrations**: Version-controlled schema changes

### 4. Backup Engine
- **BackupRunner**: Executes backup jobs
- **FileScanner**: Recursively scans directories, calculates MD5 hashes
- **HashCache**: Tracks file changes for differential backups

### 5. Web UI
- Single HTML file with vanilla JS
- Job CRUD operations
- Real-time backup execution
- History visualization

## Development Flow

1. **Start Database**: `docker-compose up -d postgres`
2. **Run Migrations**: `npm run db:migrate`
3. **Seed Data**: `npm run db:seed`
4. **Start Dev Server**: `npm run dev`
5. **Access UI**: http://localhost:3000

## Testing
- **Unit Tests**: Vitest framework
- **Coverage**: Schema validation, file hashing, cache management
- **13 Tests**: All passing

## Deployment
- Docker: `docker-compose up -d`
- Kubernetes: Ready for deployment (Dockerfile + health checks)
- Fly.io/Railway: Compatible

## API Endpoints

```
POST   /api/jobs              Create job
GET    /api/jobs              List jobs
GET    /api/jobs/:name        Get job details
PUT    /api/jobs/:name        Update job
DELETE /api/jobs/:name        Delete job
POST   /api/jobs/:name/run    Execute backup
GET    /api/jobs/:name/history Get backup history
GET    /health                Health check
```

## Scripts

```bash
# Development
npm run dev          # Start API server
npm run dev:cli      # Run CLI tool

# Production
npm run build        # Build TypeScript
npm start            # Run server
npm run start:cli    # Run CLI

# Database
npm run db:migrate   # Apply migrations
npm run db:seed      # Load demo data
npm run db:studio    # GUI for database

# Quality
npm test             # Run tests
npm run lint         # Check code style

# Docker
npm run docker:up    # Start containers
npm run docker:down  # Stop containers
```

## Tech Stack
- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16 + Prisma ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **Testing**: Vitest
- **Validation**: Zod
- **Scheduling**: node-cron

## Phase 2 Achievements ✅
- End-to-end vertical slice working
- Web UI for job management
- Complete REST API with validation
- Database persistence
- Docker containerization
- 13 passing tests
- Production-ready error handling
- Comprehensive documentation

## Next Steps (Phase 3+)
- Restore functionality
- Retention policies
- Compression & encryption
- Email/Slack notifications
- Dashboard analytics
- Multi-tenancy support
