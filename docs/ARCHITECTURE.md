# Architecture Overview

## System Design

The R2 Backup and File Archiver is built as a layered, event-driven system with clear separation of concerns and extensive extension points.

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Web UI   │  │ REST API │  │   CLI    │  │ Webhooks │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Express)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Controllers  │  │  Middleware  │  │    Routes    │     │
│  │ - Validation │  │ - Error Hand │  │ - Job Routes │     │
│  │ - Transform  │  │ - Logging    │  │ - Template   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ JobService   │  │ TemplateServ │  │ NotifService │     │
│  │              │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Domain / Business Logic                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ BackupRunner │  │ FileScanner  │  │  Scheduler   │     │
│  │              │  │ - Hash Cache │  │ - Cron Jobs  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
         ↓                   ↓                    ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Adapters   │  │  Event Bus   │  │ Repositories │
│ - Storage    │  │ - Events     │  │ - Job        │
│ - Notif      │  │ - Handlers   │  │ - Template   │
│ - Metrics    │  │              │  │ - History    │
└──────────────┘  └──────────────┘  └──────────────┘
         ↓                                  ↓
┌──────────────┐                  ┌──────────────┐
│ External     │                  │  PostgreSQL  │
│ Services     │                  │   Database   │
│ - R2         │                  │  (Prisma)    │
│ - Webhooks   │                  └──────────────┘
└──────────────┘
```

## Core Components

### 1. API Layer

**Technology**: Express.js with TypeScript

**Responsibilities**:
- HTTP request/response handling
- Request validation (Zod schemas)
- Authentication/authorization (extensible)
- Error handling and formatting
- CORS and security middleware

**Key Files**:
- `src/api/app.ts` - Express application setup
- `src/api/controllers/` - Request handlers
- `src/api/middleware/` - Shared middleware
- `src/api/routes/` - Route definitions

### 2. Service Layer

**Pattern**: Service Layer with dependency injection

**Responsibilities**:
- Business logic orchestration
- Transaction management
- Cross-cutting concerns (logging, metrics)
- Event publishing
- Integration with repositories

**Key Services**:
- `JobService` - Backup job management
- `TemplateService` - Template CRUD and instantiation
- `NotificationService` - Alert routing
- `RetentionService` - Cleanup policies

### 3. Domain Layer

**Pattern**: Domain-Driven Design

**Core Entities**:
- `BackupJob` - Configured backup task
- `BackupHistory` - Execution audit trail
- `BackupTemplate` - Reusable configuration
- `RetentionPolicy` - Lifecycle rules
- `BackupNotification` - Alert configuration

**Domain Logic**:
- `BackupRunner` - Orchestrates backup execution
- `FileScanner` - Discovers and hashes files
- `HashCacheManager` - Tracks file changes
- `BackupScheduler` - Cron-based scheduling

### 4. Infrastructure Layer

**Adapters (Strategy Pattern)**:
All adapters implement interfaces for swappable implementations:

- `IStorageAdapter` - Storage backends (R2, S3, Azure, GCS)
- `INotificationAdapter` - Alert channels (webhook, email, Slack)
- `IMetricsAdapter` - Metrics systems (Prometheus, Datadog)

**Event System**:
- Loosely-coupled event bus
- Typed domain events
- Pluggable event handlers
- Async event processing

**Repositories**:
- Data access abstraction
- Prisma ORM integration
- Query optimization
- Transaction support

## Data Flow

### Backup Execution Flow

```
1. Trigger (Scheduled/Manual/API)
   ↓
2. JobService.runBackup()
   ↓
3. Publish BackupStartedEvent
   ↓
4. BackupRunner.runBackup()
   ├→ FileScanner.scanDirectory()
   │  └→ Calculate MD5 hashes
   ├→ Check HashCache
   ├→ StorageAdapter.exists()
   └→ StorageAdapter.upload()
   ↓
5. Save BackupHistory
   ↓
6. Publish BackupCompletedEvent
   ↓
7. NotificationService handles event
   ↓
8. NotificationAdapter.send()
```

### Template Instantiation Flow

```
1. API: POST /api/templates/:name/instantiate
   ↓
2. TemplateService.instantiateJob()
   ├→ Load template from DB
   ├→ Replace ${VARIABLES}
   └→ Create BackupJob
   ↓
3. Return new job configuration
```

## Extension Points

### 1. Custom Storage Backends

Implement `IStorageAdapter`:

```typescript
class CustomStorageAdapter implements IStorageAdapter {
  async upload(options: UploadOptions) { ... }
  async download(options: DownloadOptions) { ... }
  // ... other methods
}
```

Register in configuration and use via dependency injection.

### 2. Custom Notification Channels

Implement `INotificationAdapter`:

```typescript
class SlackAdapter implements INotificationAdapter {
  async send(payload: NotificationPayload) { ... }
  async test() { ... }
}
```

### 3. Event Handlers

Subscribe to domain events:

```typescript
eventBus.subscribe('backup.completed', {
  async handle(event: BackupCompletedEvent) {
    // Custom logic (e.g., update dashboard, send to analytics)
  }
});
```

### 4. Custom Metrics

Implement `IMetricsAdapter` for your monitoring system:

```typescript
class PrometheusAdapter implements IMetricsAdapter {
  recordCounter(name: string, value: number, labels?: MetricLabels) { ... }
  // ... other methods
}
```

## Database Schema

### Entity Relationships

```
BackupTemplate (1) ──┐
                     ├──> (N) BackupJob
RetentionPolicy (1) ─┘

BackupJob (1) ──> (N) BackupHistory

BackupJob (1) ──> (N) BackupNotification

RetentionPolicy (1) ──> (N) RetentionExecution

BackupNotification (1) ──> (N) NotificationHistory
```

### Key Indexes

- `BackupJob`: name, enabled, templateId, retentionPolicyId, priority
- `BackupHistory`: jobId, status, createdAt, triggeredBy
- `BackupTemplate`: name, isPublic
- `RetentionPolicy`: name, enabled

## Scaling Considerations

### Horizontal Scaling

**Stateless API Servers**:
- All state in PostgreSQL
- Session-less design
- Load balancer compatible

**Worker Pattern** (Future):
- Separate backup execution from API
- Job queue (Redis/Bull)
- Multiple worker processes

### Vertical Scaling

**Database Optimization**:
- Connection pooling (PgBouncer)
- Read replicas for history queries
- Partitioning for large history tables

**Caching** (Future):
- Redis for hot job configurations
- CDN for static assets

### Performance

**Current Bottlenecks**:
- Single-threaded backup execution
- Serial file uploads

**Optimizations** (Future):
- Concurrent file uploads
- Streaming uploads for large files
- Compression before upload
- Incremental backups (rsync-style)

## Security

### Authentication

**Current**: None (internal tool)

**Future**:
- JWT-based API authentication
- Role-based access control (RBAC)
- Multi-tenancy support

### Data Security

**In Transit**:
- HTTPS for API
- TLS for database connections
- Signed requests to R2

**At Rest**:
- Encrypted database credentials
- Client-side encryption adapter (future)

### Audit Trail

**Current**:
- Complete backup history
- Retention execution logs
- Notification history

**Enhanced** (Future):
- API access logs
- User action audit trail
- Compliance reports

## Monitoring & Observability

### Logging

**Structured Logging**:
- JSON format
- Contextual information
- Log levels (debug, info, warn, error)

**Log Aggregation** (Future):
- ELK stack integration
- CloudWatch Logs
- Datadog Logs

### Metrics

**Key Metrics**:
- Backup success/failure rate
- Execution duration (p50, p95, p99)
- Storage usage trends
- API response times
- Queue depths

**Integration**:
- Prometheus via metrics adapter
- Custom dashboards (Grafana)

### Tracing (Future)

- OpenTelemetry integration
- Distributed request tracing
- Performance profiling

## Deployment

### Docker

**Single Container**:
- Application + migrations
- Health checks
- Graceful shutdown

**Docker Compose**:
- App + PostgreSQL
- Development environment
- Volume mounts for persistence

### Production

**Recommended Stack**:
- Kubernetes for orchestration
- PostgreSQL (managed service)
- Redis for queues
- Object storage (R2/S3)

**Configuration**:
- Environment variables
- Secrets management (Vault, AWS Secrets Manager)
- Config maps for non-sensitive data

## Testing Strategy

### Unit Tests

- Domain logic (BackupRunner, FileScanner)
- Validation schemas
- Utility functions

### Integration Tests

- API endpoints
- Database operations
- Adapter implementations

### E2E Tests

- Complete backup workflows
- Template instantiation
- Notification delivery

### Load Tests (Future)

- Concurrent backup execution
- API throughput
- Database performance

## Future Architecture Enhancements

1. **Microservices** - Split into backup-service, notification-service, etc.
2. **Event Sourcing** - Full audit trail with event store
3. **CQRS** - Separate read/write models for scalability
4. **GraphQL** - Flexible API layer
5. **WebSockets** - Real-time backup progress
6. **Plugin System** - Dynamic plugin loading
