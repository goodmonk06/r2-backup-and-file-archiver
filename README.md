# R2 Backup and File Archiver

A production-ready backup service for Cloudflare R2 with web-based management, hash-based differential backups, and scheduled job execution.

## Overview

This service provides a complete solution for backing up files to Cloudflare R2 (S3-compatible object storage). It features:

- **Web UI**: Browser-based job management and monitoring
- **REST API**: Programmatic access to all features
- **CLI Tool**: Command-line interface for automation
- **Smart Backups**: MD5 hash-based differential uploads (only changed files)
- **Job Scheduling**: Cron-based automatic backups
- **History Tracking**: Complete backup history with PostgreSQL
- **Docker Ready**: Full containerization with docker-compose

## Tech Stack

- **Backend**: Node.js 20, TypeScript, Express
- **Database**: PostgreSQL 16, Prisma ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **Testing**: Vitest
- **Validation**: Zod
- **Scheduling**: node-cron

## Domain Model Summary

### BackupJob
Represents a configured backup job with:
- `name`: Unique identifier
- `source`: Local directory to backup
- `bucket`: R2 bucket name
- `prefix`: Object key prefix in R2
- `schedule`: Cron expression
- `exclude`: File patterns to skip
- `enabled`: Active status

### BackupHistory
Tracks each backup execution:
- `jobId`: Reference to BackupJob
- `totalFiles`, `uploadedFiles`, `skippedFiles`: Metrics
- `errors`: List of errors encountered
- `startTime`, `endTime`, `duration`: Timing
- `status`: 'success' | 'partial' | 'failed'

## Getting Started

### Requirements

- Node.js 20+
- PostgreSQL 16+ (or use Docker)
- Cloudflare R2 account with API credentials

### Setup Steps

#### 1. Clone and Install

```bash
git clone <repository-url>
cd r2-backup-and-file-archiver
npm install
```

#### 2. Configure R2 Credentials

Create a Cloudflare R2 bucket and API token:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2
2. Click "Create bucket"
3. Navigate to "Manage R2 API Tokens" → "Create API Token"
4. Set permissions to "Read & Write"
5. Save the generated credentials:
   - Access Key ID
   - Secret Access Key
   - Account ID

#### 3. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/r2backup?schema=public

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id-here
R2_ACCESS_KEY_ID=your-access-key-id-here
R2_SECRET_ACCESS_KEY=your-secret-access-key-here
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# API Server
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

#### 4. Start with Docker (Recommended)

The easiest way to run the entire stack:

```bash
# Start PostgreSQL + App
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The web UI will be available at `http://localhost:3000`

#### 5. Local Development Setup

If running without Docker:

```bash
# Start PostgreSQL (required)
# Option A: Use Docker for DB only
docker run -d \
  --name r2backup-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=r2backup \
  -p 5432:5432 \
  postgres:16-alpine

# Option B: Use local PostgreSQL installation

# Run database migrations
npm run db:migrate

# Seed demo data (optional)
npm run db:seed

# Start development server
npm run dev
```

#### 6. Access the Application

- **Web UI**: http://localhost:3000
- **API Health**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/api/jobs

## Example Workflow: Complete Vertical Slice

Here's a complete end-to-end example demonstrating the core functionality:

### 1. Create a Backup Job (Web UI)

1. Open http://localhost:3000
2. Click "Create New Job"
3. Fill in:
   - Name: `my-documents`
   - Source: `./test-data`
   - Bucket: `my-backups`
   - Prefix: `docs/`
   - Schedule: `0 3 * * *` (daily at 3 AM)
4. Click "Create Job"

### 2. Create via API

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-documents",
    "source": "./test-data",
    "bucket": "my-backups",
    "prefix": "docs/",
    "schedule": "0 3 * * *",
    "enabled": true
  }'
```

### 3. List All Jobs

```bash
curl http://localhost:3000/api/jobs
```

### 4. Run Backup Immediately

Via Web UI:
- Click "Run Now" button on the job card

Via API:
```bash
curl -X POST http://localhost:3000/api/jobs/my-documents/run
```

Via CLI:
```bash
npm run dev:cli run --job my-documents
```

### 5. View Backup History

Via Web UI:
- Click "History" button on job card

Via API:
```bash
curl http://localhost:3000/api/jobs/my-documents/history
```

### 6. Update Job Configuration

```bash
curl -X PUT http://localhost:3000/api/jobs/my-documents \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "0 4 * * *",
    "enabled": false
  }'
```

## Available Scripts

### Development
```bash
npm run dev          # Start API server with hot reload
npm run dev:cli      # Run CLI tool
npm run dev:cli run --job <name>  # Run specific backup job
```

### Production
```bash
npm run build        # Compile TypeScript
npm start            # Run production server
npm run start:cli    # Run CLI in production mode
```

### Database
```bash
npm run db:migrate   # Run migrations (development)
npm run db:push      # Push schema changes (no migration)
npm run db:seed      # Populate with demo data
npm run db:studio    # Open Prisma Studio (GUI)
npm run db:generate  # Regenerate Prisma client
```

### Testing & Quality
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Open Vitest UI
npm run lint         # Check code style
npm run lint:fix     # Auto-fix linting issues
```

### Docker
```bash
npm run docker:up    # Start containers
npm run docker:down  # Stop containers
npm run docker:logs  # View container logs
```

## API Endpoints

### Jobs
- `POST /api/jobs` - Create new backup job
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:name` - Get job details
- `PUT /api/jobs/:name` - Update job configuration
- `DELETE /api/jobs/:name` - Delete job
- `POST /api/jobs/:name/run` - Execute backup immediately
- `GET /api/jobs/:name/history` - Get backup history

### System
- `GET /health` - Health check endpoint

## Demo Data

After running `npm run db:seed`, you'll have:

### Demo Jobs
- **project-files**: Daily backup of project files at 2 AM
- **documents-backup**: Daily backup of documents at 3 AM
- **database-dumps**: Weekly backup of database dumps (Sundays at 4 AM)
- **media-files**: Daily media backup at 1 AM (disabled)

### Demo History
Several completed backup runs with realistic metrics showing successful uploads, skipped files, and execution times.

## Configuration

### Cron Schedule Format

```
 ┌─── minute (0-59)
 │ ┌─── hour (0-23)
 │ │ ┌─── day of month (1-31)
 │ │ │ ┌─── month (1-12)
 │ │ │ │ ┌─── day of week (0-7, 0 and 7 = Sunday)
 │ │ │ │ │
 * * * * *
```

Examples:
- `0 3 * * *` - Every day at 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 2 * * 0` - Every Sunday at 2:00 AM
- `*/15 * * * *` - Every 15 minutes

### Exclude Patterns

- `*.tmp` - All files with .tmp extension
- `node_modules/` - Entire directory
- `.DS_Store` - Specific filename

## How It Works

### Differential Backup Algorithm

1. **Scan**: Recursively scan source directory
2. **Hash**: Calculate MD5 hash for each file
3. **Cache Check**: Compare with cached hash from previous backup
4. **R2 Check**: If hash changed, verify file doesn't exist in R2
5. **Upload**: Only upload if file is new or modified
6. **Cache Update**: Save new hash for next run

This minimizes bandwidth usage and speeds up subsequent backups.

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Web UI    │────▶│  Express API │────▶│ PostgreSQL │
│ (Browser)   │     │  + Services  │     │ (Jobs/Hist)│
└─────────────┘     └──────────────┘     └────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Backup Runner│
                    │ + File Scan  │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Cloudflare R2│
                    │  (S3 API)    │
                    └──────────────┘
```

## Troubleshooting

### Cannot connect to database
```
Error: P1001: Can't reach database server
```
**Solution**: Ensure PostgreSQL is running:
```bash
docker ps | grep postgres
# or
docker-compose up -d postgres
```

### R2 authentication failed
```
Error: The AWS Access Key Id you provided does not exist
```
**Solution**: Verify R2 credentials in `.env` are correct and the API token has Read & Write permissions.

### Port 3000 already in use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change PORT in `.env` or kill the process using port 3000.

### Tests failing
```
Solution**: Ensure test environment has no conflicting data:
```bash
rm -rf .backup-cache
npm test
```

## Future Extensions

Phase 3+ features planned:

- [ ] **Restore Functionality**: Download and restore files from R2
- [ ] **Retention Policies**: Automatic deletion of old backups
- [ ] **Compression**: Gzip/Brotli compression before upload
- [ ] **Encryption**: Client-side encryption for sensitive data
- [ ] **Notifications**: Email/Slack/Discord alerts on backup completion
- [ ] **Dashboard Charts**: Visual analytics for backup trends
- [ ] **Multi-tenancy**: Support for multiple users/organizations
- [ ] **S3 Lifecycle Rules**: Automatic transition to cheaper storage classes
- [ ] **Webhooks**: HTTP callbacks for backup events
- [ ] **Rate Limiting**: Bandwidth throttling for large backups

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure `npm test` and `npm run lint` pass
5. Submit a pull request

## License

MIT

---

**Built with ❤️ for reliable, efficient cloud backups**
